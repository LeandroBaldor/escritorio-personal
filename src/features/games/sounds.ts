// Efectos de sonido de los juegos, generados con Web Audio (sin archivos de audio).
// El contexto se crea recién con un clic o una tecla: los navegadores no dejan sonar nada antes.
import { AMBIENT_CHANNELS, type AmbientChannel } from './trepaSound';
import { LAVA_CHANNELS, type LavaChannel } from './lavaSound';
import { STORM_CHANNELS, type StormChannel } from './sharkSound';
import { INVASION_CHANNELS, type InvasionChannel } from './invasionSound';
import bombaUrl from './assets/sonidos/bomba.mp3';
import personaCaeUrl from './assets/sonidos/persona-cae.mp3';
import t800Url from './assets/sonidos/t800.mp3';
import lluviaUrl from './assets/sonidos/lluvia.mp3';
import tiburonAtacaUrl from './assets/sonidos/tiburon-ataca.mp3';
import victoriaUrl from './assets/sonidos/victoria.mp3';
import cartaUrl from './assets/sonidos/carta.mp3';
import cartaSobreCartaUrl from './assets/sonidos/carta-sobre-carta.mp3';
import cartaArribaUrl from './assets/sonidos/carta-arriba.mp3';
import paloCompletoUrl from './assets/sonidos/palo-completo.mp3';
import mazoVacioUrl from './assets/sonidos/mazo-vacio.mp3';
import mazoReiniciaUrl from './assets/sonidos/mazo-reinicia.mp3';
import cartaMazoUrl from './assets/sonidos/carta-mazo.mp3';
import cartaAsUrl from './assets/sonidos/carta-as.mp3';
import columnaLibreUrl from './assets/sonidos/columna-libre.mp3';
import solitarioGanasteUrl from './assets/sonidos/solitario-ganaste.mp3';
import gameOverUrl from './assets/sonidos/game-over.mp3';
import ganasteUrl from './assets/sonidos/ganaste.mp3';
import jugarUrl from './assets/sonidos/jugar.mp3';
import golUrl from './assets/sonidos/gol.mp3';
import hinchadaUrl from './assets/sonidos/hinchada.mp3';
import patadaUrl from './assets/sonidos/patada.mp3';
import trueno1Url from './assets/sonidos/trueno-1.mp3';
import trueno2Url from './assets/sonidos/trueno-2.mp3';
import trueno3Url from './assets/sonidos/trueno-3.mp3';
import lavaUrl from './assets/sonidos/lava.mp3';
import helicopteroUrl from './assets/sonidos/helicoptero.mp3';
import fuegoUrl from './assets/sonidos/fuego.mp3';
import personaQuemaUrl from './assets/sonidos/persona-quema.mp3';
import lavaAscensorUrl from './assets/sonidos/lava-ascensor.mp3';
import lavaElectricidadUrl from './assets/sonidos/lava-electricidad.mp3';
import lavaPersonaFuegoUrl from './assets/sonidos/lava-persona-fuego.mp3';
import lavaSirenaUrl from './assets/sonidos/lava-sirena.mp3';
import invTiroUrl from './assets/sonidos/invasion-tiro.mp3';
import invSangreAlienUrl from './assets/sonidos/invasion-sangre-alien.mp3';
import invSangreHumanoUrl from './assets/sonidos/invasion-sangre-humano.mp3';
import invBombaUrl from './assets/sonidos/invasion-bomba.mp3';
import invAutosUrl from './assets/sonidos/invasion-autos.mp3';
import invPajarosUrl from './assets/sonidos/invasion-pajaros.mp3';
import invPersonasUrl from './assets/sonidos/invasion-personas.mp3';
import invOvniUrl from './assets/sonidos/invasion-ovni.mp3';
import invOvniDisparoUrl from './assets/sonidos/invasion-ovni-disparo.mp3';
import invAlienHablaUrl from './assets/sonidos/invasion-alien-habla.mp3';
import invLluviaUrl from './assets/sonidos/invasion-lluvia.mp3';
import propulsorUrl from './assets/sonidos/propulsor.mp3';
import trepaCiudadUrl from './assets/sonidos/trepa-ciudad.mp3';
import trepaPajarosUrl from './assets/sonidos/trepa-pajaros.mp3';
import trepaOvniUrl from './assets/sonidos/trepa-ovni.mp3';
import trepaLaserUrl from './assets/sonidos/trepa-laser.mp3';
import trepaEngranajeUrl from './assets/sonidos/trepa-engranaje.mp3';
import trepaEscalonesUrl from './assets/sonidos/trepa-escalones.mp3';
import trepaAscensorTecUrl from './assets/sonidos/trepa-ascensor-tec.mp3';
import trepaAbducidoUrl from './assets/sonidos/trepa-abducido.mp3';
import trepaFuegoTecUrl from './assets/sonidos/trepa-fuego-tec.mp3';
import trepaLluviaUrl from './assets/sonidos/trepa-lluvia.mp3';
import trepaVientoUrl from './assets/sonidos/trepa-viento.mp3';
import trepaHelicopteroUrl from './assets/sonidos/trepa-helicoptero.mp3';
import trepaAvionUrl from './assets/sonidos/trepa-avion.mp3';
import trepaPalomasUrl from './assets/sonidos/trepa-palomas.mp3';
import trepaAscensorUrl from './assets/sonidos/trepa-ascensor.mp3';
import trepaFuegoUrl from './assets/sonidos/trepa-fuego.mp3';
import trepaGritoUrl from './assets/sonidos/trepa-grito.mp3';
import agujeroNegroUrl from './assets/sonidos/agujero-negro.mp3';
import laserUrl from './assets/sonidos/laser.mp3';
import monstruoUrl from './assets/sonidos/monstruo-pez.mp3';
import puertaUrl from './assets/sonidos/puerta.mp3';
import explosionUrl from './assets/sonidos/explosion.mp3';
import gusanoUrl from './assets/sonidos/gusano.mp3';
import pasosUrl from './assets/sonidos/pasos.mp3';
import musicaGravedadUrl from './assets/sonidos/musica-gravedad.mp3';

type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let ambient: Record<AmbientChannel, { gain: GainNode; max: number }> | null = null;
let master: AudioNode | null = null;

export function unlockSounds() {
  try {
    const Ctor = globalThis.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state !== 'running') void ctx.resume(); // también si Safari lo dejó "interrumpido"
    master ??= limiter(ctx);
  } catch { /* sin audio: el juego sigue en silencio */ }
}

// Todo pasa por un limitador, así varios sonidos juntos no saturan.
function limiter(c: AudioContext) {
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.2;
  comp.connect(c.destination);
  return comp;
}
const out = (c: AudioContext) => master ?? c.destination;
// Si el navegador pausó el audio (por ejemplo, al cambiar de pestaña o bloquear la pantalla), lo reactiva;
// ese sonido se pierde, pero los siguientes ya suenan.
const running = () => {
  if (!ctx) return null;
  if (ctx.state === 'running') return ctx;
  void ctx.resume().catch(() => { /* el navegador no lo dejó: se reintenta con el próximo sonido */ });
  return null;
};

function noiseBuffer(c: AudioContext) {
  if (noise) return noise;
  noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}
const noiseSource = (c: AudioContext, loop = true) => { const s = c.createBufferSource(); s.buffer = noiseBuffer(c); s.loop = loop; return s; };
const filter = (c: AudioContext, type: BiquadFilterType, frequency: number, Q = 1) => { const f = c.createBiquadFilter(); f.type = type; f.frequency.value = frequency; f.Q.value = Q; return f; };
const osc = (c: AudioContext, type: OscillatorType, frequency: number) => { const o = c.createOscillator(); o.type = type; o.frequency.value = frequency; return o; };
// Hace "temblar" un parámetro (volumen o tono) a cierta velocidad, para que el sonido tenga vida.
function wobble(c: AudioContext, param: AudioParam, rate: number, depth: number, type: OscillatorType = 'sine') {
  const lfo = osc(c, type, rate), amount = c.createGain();
  amount.gain.value = depth;
  lfo.connect(amount).connect(param);
  lfo.start();
}

// Sonidos de ambiente: suenan siempre, en silencio, y se suben según lo cerca que esté cada objeto.
type Channel = { gain: GainNode; max: number };
function ambientChannel(c: AudioContext, max: number, make: (out: GainNode) => void): Channel {
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(out(c));
  make(gain);
  return { gain, max };
}
function buildAmbient(c: AudioContext) {
  const channel = (max: number, make: (out: GainNode) => void) => ambientChannel(c, max, make);
  // El clima de Trepaluna (grabaciones que se repiten sin corte; mientras cargan, un ruido parecido).
  const noisy = (type: BiquadFilterType, f: number, level: number) => (out: GainNode) => { const n = noiseSource(c), fl = filter(c, type, f), g = c.createGain(); g.gain.value = level; n.connect(fl).connect(g).connect(out); n.start(); };
  return {
    // La ciudad: tránsito, bocinas y gente (hasta los 1.000 m).
    city: channel(1, out => recorded(c, trepaCiudadUrl, 1.7, out, noisy('lowpass', 500, 0.15))),
    // Zona tecnológica: los láseres prendidos, los engranajes, los escalones que aparecen y desaparecen
    // (mientras están) y los elevadores mecánicos (pistones).
    laser: channel(0.7, out => recorded(c, trepaLaserUrl, 1, out, () => {})),
    gear: channel(0.75, out => recorded(c, trepaEngranajeUrl, 1, out, () => {})),
    blink: channel(0.6, out => recorded(c, trepaEscalonesUrl, 1, out, () => {})),
    piston: channel(0.7, out => recorded(c, trepaAscensorTecUrl, 1, out, () => {})),
    // Entre los 1.000 y los 2.000 m: pájaros cantando.
    birdsong: channel(0.8, out => recorded(c, trepaPajarosUrl, 1, out, () => {})),
    // Pisos que suben y bajan como ascensor: la grabación del ascensor.
    lift: channel(0.7, out => recorded(c, trepaAscensorUrl, 0.9, out, noisy('lowpass', 300, 0.2))),
    // La lluvia fuerte de la tormenta (de 2.000 a 3.000 m).
    rain: channel(1, out => recorded(c, trepaLluviaUrl, 1.1, out, noisy('highpass', 1500, 0.3))),
    // El viento fuerte de arriba (desde los 3.000 m).
    gale: channel(0.5, out => recorded(c, trepaVientoUrl, 0.95, out, noisy('bandpass', 400, 0.35))),
    // Fuego: un rugido grave con chisporroteo.
    fire: channel(0.12, out => { // (más bajo: cuando se prende suena la llamarada grabada, ver playFlame)
      const roar = noiseSource(c), body = filter(c, 'lowpass', 700);
      roar.connect(body).connect(out); roar.start();
      const crackle = noiseSource(c), hi = filter(c, 'bandpass', 2600, 3), level = c.createGain();
      level.gain.value = 0.25; wobble(c, level.gain, 9, 0.25, 'square');
      crackle.connect(hi).connect(level).connect(out); crackle.start();
    }),
    // Pisos que van y vienen, montacargas y engranajes: un motor grave que vibra.
    motor: channel(0.4, out => {
      const engine = osc(c, 'sawtooth', 58), low = filter(c, 'lowpass', 320), level = c.createGain();
      level.gain.value = 0.7; wobble(c, level.gain, 7, 0.3);
      engine.connect(low).connect(level).connect(out); engine.start();
    }),
    // Cinta transportadora: un traqueteo rápido.
    conveyor: channel(0.45, out => {
      const rattle = noiseSource(c), band = filter(c, 'bandpass', 1100, 4), level = c.createGain();
      level.gain.value = 0.5; wobble(c, level.gain, 14, 0.5, 'square');
      rattle.connect(band).connect(level).connect(out); rattle.start();
    }),
    // Bola de demolición: el "fsss" del aire al pasar.
    swing: channel(0.75, out => {
      const air = noiseSource(c), band = filter(c, 'bandpass', 450, 1.2);
      air.connect(band).connect(out); air.start();
    }),
    // Pájaros: piídos cortos que van y vienen.
    // Palomas: la grabación del arrullo y el aleteo (mientras carga, el piído sintetizado).
    bird: channel(0.8, out => recorded(c, trepaPalomasUrl, 1.6, out, out => {
      const tweet = osc(c, 'sine', 3000), gate = c.createGain(), pattern = c.createGain();
      wobble(c, tweet.frequency, 9, 900, 'sawtooth');
      gate.gain.value = 0.5; wobble(c, gate.gain, 2.6, 0.5, 'square');
      pattern.gain.value = 0.5; wobble(c, pattern.gain, 0.55, 0.5, 'square');
      tweet.connect(gate).connect(pattern).connect(out); tweet.start();
    })),
    // Aviones: el rugido grave del motor al pasar.
    // Aviones: la grabación del motor del avión.
    plane: channel(0.85, out => recorded(c, trepaAvionUrl, 0.8, out, out => {
      const jet = noiseSource(c), body = filter(c, 'lowpass', 650);
      jet.connect(body).connect(out); jet.start();
      const engine = osc(c, 'sawtooth', 74), low = filter(c, 'lowpass', 380), level = c.createGain();
      level.gain.value = 0.5; wobble(c, level.gain, 3, 0.15);
      engine.connect(low).connect(level).connect(out); engine.start();
    })),
    // Drones: zumbido agudo de hélices.
    drone: channel(0.2, out => {
      const buzz = osc(c, 'sawtooth', 260), low = filter(c, 'lowpass', 1600);
      wobble(c, buzz.frequency, 24, 22);
      buzz.connect(low).connect(out); buzz.start();
    }),
    // Meteoritos: un estruendo grave que chisporrotea.
    meteor: channel(0.6, out => {
      const rumble = noiseSource(c), low = filter(c, 'lowpass', 220);
      rumble.connect(low).connect(out); rumble.start();
      const crackle = noiseSource(c), band = filter(c, 'bandpass', 1500, 2), level = c.createGain();
      level.gain.value = 0.2; wobble(c, level.gain, 17, 0.2, 'square');
      crackle.connect(band).connect(level).connect(out); crackle.start();
    }),
    // Láseres y rayos: zumbido eléctrico.
    electric: channel(0.22, out => {
      const zap = osc(c, 'square', 120), band = filter(c, 'bandpass', 1800, 2), level = c.createGain();
      level.gain.value = 0.75; wobble(c, level.gain, 31, 0.25, 'square');
      zap.connect(band).connect(level).connect(out); zap.start();
    }),
    // Ventiladores: viento.
    wind: channel(0.65, out => {
      const air = noiseSource(c), low = filter(c, 'lowpass', 480), level = c.createGain();
      level.gain.value = 0.8; wobble(c, level.gain, 0.7, 0.2);
      air.connect(low).connect(level).connect(out); air.start();
    }),
    // Imanes y teletransportadores: un zumbido grave y parejo.
    hum: channel(0.3, out => {
      for (const f of [110, 221]) { const tone = osc(c, 'sine', f); tone.connect(out); tone.start(); }
    }),
    // Globo aerostático: el "fwoosh" del quemador de gas (fuerte cuando sube).
    balloon: channel(0.7, out => {
      const gas = noiseSource(c), band = filter(c, 'bandpass', 360, 0.8), level = c.createGain();
      level.gain.value = 0.8; wobble(c, level.gain, 13, 0.2);
      gas.connect(band).connect(level).connect(out); gas.start();
    }),
    // Dirigible: el golpeteo grave de la hélice.
    propeller: channel(0.5, out => {
      const engine = osc(c, 'sawtooth', 46), low = filter(c, 'lowpass', 260), chop = c.createGain();
      chop.gain.value = 0.5; wobble(c, chop.gain, 16, 0.5);
      engine.connect(low).connect(chop).connect(out); engine.start();
    }),
    // Baldosas voladoras: el zumbido de sus helicitas.
    // Baldosas voladoras (escalones con ventiladores): la grabación del helicóptero.
    hover: channel(0.6, out => recorded(c, trepaHelicopteroUrl, 0.8, out, out => {
      const whir = osc(c, 'sawtooth', 330), low = filter(c, 'lowpass', 1500), level = c.createGain();
      wobble(c, whir.frequency, 1.5, 15);
      level.gain.value = 0.6; wobble(c, level.gain, 38, 0.4);
      whir.connect(low).connect(level).connect(out); whir.start();
    })),
    // Pistones y bloques tecnológicos: aire comprimido y un zumbido hidráulico.
    hydraulic: channel(0.35, out => {
      const hiss = noiseSource(c), hi = filter(c, 'highpass', 2200), level = c.createGain();
      level.gain.value = 0.5; wobble(c, level.gain, 1.1, 0.4);
      hiss.connect(hi).connect(level).connect(out); hiss.start();
      const pump = osc(c, 'sine', 90); pump.connect(out); pump.start();
    }),
    // Ovnis y satélites: el clásico sonido ondulante de ciencia ficción.
    ufo: channel(0.8, out => recorded(c, trepaOvniUrl, 1, out, out => { // la grabación del ovni (mientras carga, el ondulante clásico)
      const quiet = c.createGain(); quiet.gain.value = 0.18; quiet.connect(out);
      for (const [f, rate, depth] of [[520, 7, 120], [780, 5, 60]]) { const tone = osc(c, 'sine', f); wobble(c, tone.frequency, rate, depth); tone.connect(quiet); tone.start(); }
    })),
  };
}

// levels: cuánto se escucha cada objeto (0 a 1); null apaga todo el ambiente (pausa, fin de partida).
export function setAmbient(levels: Record<AmbientChannel, number> | null) {
  if (!ctx || (!ambient && !levels)) return;
  ambient ??= buildAmbient(ctx); // se arma recién cuando un juego lo usa (Trepaluna)
  const t = ctx.currentTime;
  for (const name of AMBIENT_CHANNELS) {
    const { gain, max } = ambient[name];
    gain.gain.setTargetAtTime(levels ? levels[name] * max : 0, t, levels ? 0.08 : 0.03);
  }
}

// ---------- Sonidos de evento ----------
// Un tono que va de una frecuencia a otra, con un golpe de volumen al principio que se apaga.
function tone(c: AudioContext, type: OscillatorType, from: number, to: number, start: number, length: number, volume: number) {
  const o = osc(c, type, from), gain = c.createGain();
  o.frequency.setValueAtTime(from, start);
  o.frequency.exponentialRampToValueAtTime(to, start + length * 0.8);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  o.connect(gain).connect(out(c));
  o.start(start);
  o.stop(start + length + 0.02);
}
function burst(c: AudioContext, type: BiquadFilterType, frequency: number, start: number, length: number, volume: number) {
  const s = noiseSource(c, false), f = filter(c, type, frequency), gain = c.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  s.connect(f).connect(gain).connect(out(c));
  s.start(start);
  s.stop(start + length + 0.02);
}

// Salto: un "boing" corto que sube de tono.
export function playJump(volume = 0.35) {
  const c = running(); if (!c) return;
  tone(c, 'square', 330, 760, c.currentTime, 0.14, volume);
}
// Trampolín: como una cama elástica. Primero el "thump" grave de la lona y después el "boooing" del
// resorte, que sube de tono y vibra cada vez menos hasta apagarse.
export function playTramp() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sine', 120, 50, t, 0.18, 0.8); // la lona
  for (const [type, mult, volume] of [['triangle', 1, 0.6], ['sine', 2, 0.15]] as const) {
    const o = osc(c, type, 170 * mult), gain = c.createGain(), lfo = osc(c, 'sine', 11), depth = c.createGain();
    o.frequency.setValueAtTime(170 * mult, t + 0.03);
    o.frequency.exponentialRampToValueAtTime(430 * mult, t + 0.15);
    o.frequency.exponentialRampToValueAtTime(360 * mult, t + 0.8);
    depth.gain.setValueAtTime(90 * mult, t + 0.05); // la vibración del resorte, que se va calmando
    depth.gain.exponentialRampToValueAtTime(1, t + 0.8);
    lfo.connect(depth).connect(o.frequency);
    gain.gain.setValueAtTime(0.0001, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    o.connect(gain).connect(out(c));
    o.start(t + 0.03); lfo.start(t + 0.03); o.stop(t + 0.9); lfo.stop(t + 0.9);
  }
}
// Ladrillos o vidrio que se desarman.
export function playCrumble() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 4; i++) burst(c, 'bandpass', 900 + i * 500, t + i * 0.06, 0.12, 0.7);
}
// Te chocó un pájaro, un dron o la bola: un golpe seco.
export function playKnock() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sine', 180, 60, t, 0.18, 0.8);
  burst(c, 'lowpass', 1200, t, 0.08, 0.7);
}
// Teletransportador: un barrido de ciencia ficción.
export function playTeleport() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sine', 300, 1800, t, 0.3, 0.5);
  tone(c, 'triangle', 1800, 300, t + 0.12, 0.3, 0.3);
}
// Perder: quemado (llamarada) o electrocutado (chispazo), y en todos los casos un grito corto mientras cae.
export function playLose(reason: 'burn' | 'zap' | 'fall') {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  if (reason === 'burn') burst(c, 'lowpass', 900, t, 0.7, 0.9);
  else if (reason === 'zap') { tone(c, 'sawtooth', 1400, 90, t, 0.35, 0.5); burst(c, 'highpass', 3000, t, 0.25, 0.5); }
  // El grito al caer: la grabación (si todavía no cargó, el grito sintetizado).
  if (!playSample(trepaGritoUrl, 1.4, reason === 'fall' ? 0 : 0.12)) scream(c, t + (reason === 'fall' ? 0 : 0.12));
}
// Un "¡aaah!" corto: una voz sintética (cuerdas vocales + resonancias de la boca) que baja de tono.
// pitch: más agudo o más grave (cada persona grita distinto); volume: según lo lejos que esté.
function scream(c: AudioContext, start: number, pitch = 1, volume = 0.9) {
  const voice = osc(c, 'sawtooth', 620 * pitch), gain = c.createGain();
  voice.frequency.setValueAtTime(620 * pitch, start);
  voice.frequency.exponentialRampToValueAtTime(700 * pitch, start + 0.12);
  voice.frequency.exponentialRampToValueAtTime(300 * pitch, start + 0.75);
  wobble(c, voice.frequency, 7, 18 * pitch);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.04);
  gain.gain.setValueAtTime(volume, start + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.8);
  voice.connect(gain);
  for (const [f, q, level] of [[800, 6, 1], [1200, 7, 0.7], [2600, 8, 0.25]]) {
    const formant = filter(c, 'bandpass', f, q), amount = c.createGain();
    amount.gain.value = level;
    gain.connect(formant).connect(amount).connect(out(c));
  }
  voice.start(start); voice.stop(start + 0.85);
}
// GAME OVER: la musiquita triste de los videojuegos viejos (cuatro notas que bajan y la última tiembla).
// thud: un golpe antes de la música (en Trepaluna, el personaje contra la calle).
// thud: un golpe antes (en Trepaluna, el personaje contra la calle). Suena la grabación de GAME OVER; mientras
// carga, la musiquita sintetizada.
export function playGameOver(thud = false) {
  whenRunning(c => {
    if (thud) burst(c, 'lowpass', 300, c.currentTime, 0.25, 0.8);
    if (!playSample(gameOverUrl, 0.9, thud ? 0.2 : 0)) gameOverTune(c);
  });
}
function gameOverTune(c: AudioContext) {
  const t = c.currentTime;
  const notes: [number, number, number][] = [[392, 0.25, 0.22], [370, 0.5, 0.22], [349, 0.75, 0.22], [330, 1.0, 0.9]];
  for (const [f, at, length] of notes) {
    const o = osc(c, 'square', f), gain = c.createGain(), s = t + at;
    if (length > 0.5) wobble(c, o.frequency, 6, 8);
    gain.gain.setValueAtTime(0.0001, s);
    gain.gain.exponentialRampToValueAtTime(0.28, s + 0.01);
    gain.gain.setValueAtTime(0.28, s + length * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, s + length);
    o.connect(gain).connect(out(c));
    o.start(s); o.stop(s + length + 0.02);
  }
}
// Llegar a la Luna: un acorde que sube.
export function playWin() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => tone(c, 'square', f, f, t + i * 0.13, 0.35, 0.3));
}

// ---------- SkynetBall ----------
// Sonidos grabados (archivos .mp3): se cargan una sola vez y se reproducen por el mismo limitador que el resto.
const samples = new Map<string, AudioBuffer | 'loading'>();
// Para decodificar los archivos antes del primer clic (cuando todavía no hay audio) alcanza con un contexto
// "fuera de línea", que no hace ruido: así el sonido de "Jugar" ya está listo cuando lo tocás.
let offline: BaseAudioContext | null = null;
function decoder(): BaseAudioContext | null {
  if (ctx) return ctx;
  if (offline) return offline;
  const Offline = globalThis.OfflineAudioContext as typeof OfflineAudioContext | undefined;
  if (!Offline) return null;
  try { offline = new Offline(1, 1, 44100); } catch { return null; }
  return offline;
}
function loadSample(url: string) {
  const c = decoder();
  if (!c || samples.has(url)) return;
  samples.set(url, 'loading');
  fetch(url).then(r => r.arrayBuffer()).then(data => c.decodeAudioData(data)).then(buffer => { samples.set(url, buffer); })
    .catch(() => { samples.delete(url); }); // si falla, se reintenta la próxima vez y mientras suena el sintetizado
}
export function preloadSkynetSounds() { loadSample(t800Url); loadSample(personaCaeUrl); }
// Devuelve false si el archivo todavía no está listo (entonces suena el sonido sintetizado de respaldo).
function playSample(url: string, volume: number, delay = 0, rate = 1) {
  const c = running(), buffer = samples.get(url);
  if (!c || !(buffer instanceof AudioBuffer)) { loadSample(url); return false; }
  const source = c.createBufferSource(), gain = c.createGain();
  source.buffer = buffer; source.playbackRate.value = rate; gain.gain.value = volume;
  source.connect(gain).connect(out(c)); source.start(c.currentTime + delay);
  return true;
}

// Si el audio todavía se está activando (recién se tocó "Jugar"), espera un instante y suena igual.
function whenRunning(play: (c: AudioContext) => void) {
  if (!ctx) return;
  if (ctx.state === 'running') { play(ctx); return; }
  void ctx.resume().then(() => { if (ctx?.state === 'running') play(ctx); }).catch(() => { /* sin audio */ });
}

// Enceste: un "¡tiling!" agudo y brillante, cuatro notas que suben con un destello al final.
export function playScore() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  [1319, 1760, 2217, 2637].forEach((f, i) => { tone(c, 'triangle', f, f, t + i * 0.06, 0.22, 0.32); tone(c, 'sine', f * 2, f * 2, t + i * 0.06, 0.12, 0.08); });
  tone(c, 'sine', 3520, 4186, t + 0.26, 0.35, 0.18);
}

// La persona cae: corto. Un golpe seco contra el piso y una salpicadura leve de sangre.
// hard (0 a 1): qué tan fuerte cayó.
export function playSplat(hard: number) {
  if (playSample(personaCaeUrl, 0.75 + hard * 0.25)) return; // el sonido grabado de la caída
  const c = running(); if (!c) return;
  const t = c.currentTime, k = 0.6 + hard * 0.4;
  tone(c, 'sine', 105, 50, t, 0.15, 3.4 * k); // el golpe
  burst(c, 'lowpass', 420, t, 0.07, 2.8 * k);
  const wet = noiseSource(c, false), band = filter(c, 'bandpass', 1500, 1.3), gain = c.createGain(); // salpicadura leve
  band.frequency.setValueAtTime(1500, t + 0.02); band.frequency.exponentialRampToValueAtTime(700, t + 0.13);
  gain.gain.setValueAtTime(0.0001, t + 0.015); gain.gain.exponentialRampToValueAtTime(0.3 * k, t + 0.03); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  wet.connect(band).connect(gain).connect(out(c)); wet.start(t + 0.015); wet.stop(t + 0.16);
}

// La persona pega en el borde del tacho de metal: un "clonk" seco y el metal del tacho que vibra un instante.
let lastBinHit = -1;
export function playBinHit() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  if (t - lastBinHit < 0.15) return; // si queda rodando sobre el borde, no repite el golpe
  lastBinHit = t;
  tone(c, 'sine', 210, 90, t, 0.12, 0.7);
  burst(c, 'bandpass', 1400, t, 0.05, 0.6);
  for (const [f, vol, length] of [[520, 0.35, 0.45], [1240, 0.2, 0.35], [2110, 0.12, 0.25], [3370, 0.06, 0.15]]) tone(c, 'sine', f, f * 0.97, t + 0.003, length, vol);
}

// Silbato de árbitro al empezar cada cuarto: un pitido agudo con el trino de la bolita.
export function playWhistle(pattern: [number, number][] = [[0, 0.18], [0.24, 0.55]]) {
  whenRunning(c => {
    const t = c.currentTime;
    for (const [at, length] of pattern) {
      const o = osc(c, 'sine', 2900), gain = c.createGain(), s = t + at;
      wobble(c, o.frequency, 32, 220, 'square'); // la bolita adentro del silbato
      gain.gain.setValueAtTime(0.0001, s); gain.gain.exponentialRampToValueAtTime(0.32, s + 0.02);
      gain.gain.setValueAtTime(0.32, s + length * 0.8); gain.gain.exponentialRampToValueAtTime(0.0001, s + length);
      o.connect(gain).connect(out(c)); o.start(s); o.stop(s + length + 0.02);
      burst(c, 'highpass', 4000, s, length * 0.9, 0.05); // el soplido
    }
  });
}

// Brazo robótico al tirar, como el T-800 de Terminator: el servomotor agudo y eléctrico que sube de tono
// (con un zumbido metálico y algo de suciedad), un motor grave debajo y un "ker-chunk" pesado de metal con
// un soplido de hidráulica cuando el brazo se frena al soltar.
function grit(c: AudioContext, amount: number) {
  const shaper = c.createWaveShaper(), curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * amount) / Math.tanh(amount); }
  shaper.curve = curve;
  return shaper;
}
export function playRobotThrow() {
  if (playSample(t800Url, 0.35)) return; // el sonido grabado del T-800
  const c = running(); if (!c) return;
  const t = c.currentTime, turn = 0.2;
  // Servo: dos osciladores apenas desafinados, con un vibrato rápido y eléctrico, sucios y resonantes.
  const band = filter(c, 'bandpass', 1500, 3), dirt = grit(c, 3), sg = c.createGain();
  for (const [type, detune] of [['sawtooth', 0], ['square', 14]] as const) {
    const o = osc(c, type, 820); o.detune.value = detune;
    o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(1650, t + turn * 0.8); o.frequency.exponentialRampToValueAtTime(1450, t + turn);
    wobble(c, o.frequency, 72, 35);
    o.connect(dirt); o.start(t); o.stop(t + turn + 0.04);
  }
  sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.42, t + 0.015); sg.gain.setValueAtTime(0.42, t + turn - 0.03); sg.gain.exponentialRampToValueAtTime(0.0001, t + turn + 0.02);
  dirt.connect(band).connect(sg).connect(out(c));
  // Motor grave debajo.
  const motor = osc(c, 'sawtooth', 62), low = filter(c, 'lowpass', 420), mg = c.createGain();
  motor.frequency.setValueAtTime(62, t); motor.frequency.exponentialRampToValueAtTime(96, t + turn);
  mg.gain.setValueAtTime(0.0001, t); mg.gain.exponentialRampToValueAtTime(0.4, t + 0.03); mg.gain.exponentialRampToValueAtTime(0.0001, t + turn + 0.03);
  motor.connect(low).connect(mg).connect(out(c)); motor.start(t); motor.stop(t + turn + 0.05);
  // Ker-chunk: golpe grave, chasquido metálico y metal que vibra un instante.
  const lock = t + turn;
  tone(c, 'sine', 140, 55, lock, 0.16, 1.1);
  burst(c, 'bandpass', 2400, lock, 0.035, 0.9);
  burst(c, 'lowpass', 700, lock + 0.035, 0.06, 0.7);
  for (const [f, vol, length] of [[960, 0.22, 0.22], [1730, 0.14, 0.18], [2890, 0.08, 0.12]]) tone(c, 'sine', f, f * 0.98, lock, length, vol);
  burst(c, 'highpass', 4500, lock + 0.05, 0.16, 0.18); // hidráulica
}

// Ventilador de la oficina: motor y aspas; level 0 lo apaga.
let fan: GainNode | null = null;
export function setFanSound(level: number) {
  if (!ctx || (!fan && level <= 0)) return;
  if (!fan) {
    fan = ctx.createGain(); fan.gain.value = 0; fan.connect(out(ctx));
    const motor = osc(ctx, 'sawtooth', 100), low = filter(ctx, 'lowpass', 380), chop = ctx.createGain();
    chop.gain.value = 0.55; wobble(ctx, chop.gain, 22, 0.3); // las aspas
    motor.connect(low).connect(chop).connect(fan); motor.start();
    const air = noiseSource(ctx), airLow = filter(ctx, 'bandpass', 700, 0.7), airLevel = ctx.createGain();
    airLevel.gain.value = 0.9; air.connect(airLow).connect(airLevel).connect(fan); air.start();
  }
  fan.gain.setTargetAtTime(Math.max(0, level) * 0.17, ctx.currentTime, 0.15);
}

// ---------- ¡Cuidado, bloques! ----------
// Paso: un golpecito suave de zapatilla (alterna un poco el tono, como pie izquierdo y derecho).
let stepSide = 0;
export function playFootstep() {
  const c = running(); if (!c) return;
  stepSide = 1 - stepSide;
  const t = c.currentTime, f = stepSide ? 150 : 175;
  tone(c, 'sine', f, f * 0.6, t, 0.07, 0.35);
  burst(c, 'bandpass', 900, t, 0.035, 0.18);
}
// Una pieza de tetris se apoya: el "tok" seco de un bloque duro que cae. Si completó filas, una escalera de
// notas que sube (más larga cuantas más filas).
export function playBlockLand(lines: number) {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sine', 190, 75, t, 0.12, 0.6);
  burst(c, 'bandpass', 1200, t, 0.04, 0.45);
  tone(c, 'square', 420, 300, t, 0.03, 0.06);
  if (lines > 0) [523, 659, 784, 1047, 1319, 1568].slice(0, 2 + lines).forEach((f, i) => tone(c, 'square', f, f, t + 0.06 + i * 0.07, 0.14, 0.16));
}
export function preloadBlockSounds() { loadSample(bombaUrl); }
// Explosión de una bomba: el sonido grabado; si todavía no cargó, un estallido sintetizado que retumba.
export function playExplosion() {
  if (playSample(bombaUrl, 0.9)) return;
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sine', 90, 28, t, 0.6, 1.2); // retumbo
  const blast = noiseSource(c, false), low = filter(c, 'lowpass', 2400), gain = c.createGain();
  low.frequency.setValueAtTime(2400, t); low.frequency.exponentialRampToValueAtTime(120, t + 0.8);
  gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(1.1, t + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  blast.connect(low).connect(gain).connect(out(c)); blast.start(t); blast.stop(t + 0.95);
  for (let i = 0; i < 6; i++) burst(c, 'highpass', 2500, t + 0.1 + Math.random() * 0.4, 0.03, 0.15); // escombros
}

// ---------- ¡El piso es de lava! ----------
let lavaAmbient: Record<LavaChannel, Channel> | null = null;
export function preloadLavaSounds() { for (const url of [lavaUrl, helicopteroUrl, lavaElectricidadUrl, fuegoUrl, personaQuemaUrl, lavaAscensorUrl, lavaPersonaFuegoUrl, lavaSirenaUrl, pasosUrl]) loadSample(url); }
// Un sonido de ambiente grabado que se repite sin corte (el mp3 deja un silencito en las puntas, se saltea).
// Mientras carga suena el sintetizado (`synth`) y, apenas está, se pasa a la grabación.
function recorded(c: AudioContext, url: string, volume: number, out: GainNode, synth: (out: GainNode) => void) {
  const fallback = c.createGain(); fallback.connect(out);
  synth(fallback);
  whenLoaded(url, buffer => {
    const loop = c.createBufferSource(), level = c.createGain();
    loop.buffer = buffer; loop.loop = true; loop.loopStart = 0.03; loop.loopEnd = buffer.duration - 0.03;
    level.gain.value = volume;
    loop.connect(level).connect(out); loop.start(0, 0.03);
    fallback.gain.setTargetAtTime(0, c.currentTime, 0.3);
  });
}
function buildLavaAmbient(c: AudioContext): Record<LavaChannel, Channel> {
  const channel = (max: number, make: (out: GainNode) => void) => ambientChannel(c, max, make);
  return {
    // Lava: la grabación del burbujeo (mientras carga, un retumbo grave y espeso, burbujas que revientan
    // ("blup") y un chirrido de piedra que se quema).
    lava: channel(0.7, out => recorded(c, lavaUrl, 1.2, out, out => {
      const rumble = noiseSource(c), low = filter(c, 'lowpass', 150), level = c.createGain();
      level.gain.value = 0.9; wobble(c, level.gain, 0.4, 0.25);
      rumble.connect(low).connect(level).connect(out); rumble.start();
      for (const [f, rate, gateRate, depth] of [[170, 3.1, 2.3, 160], [230, 4.3, 1.7, 220]]) {
        const bubble = osc(c, 'sine', f), gate = c.createGain(), pattern = c.createGain();
        wobble(c, bubble.frequency, rate, depth, 'sawtooth'); // cada burbuja sube de tono al reventar
        gate.gain.value = 0.25; wobble(c, gate.gain, rate, 0.25, 'square');
        pattern.gain.value = 0.5; wobble(c, pattern.gain, gateRate * 0.31, 0.5, 'square');
        bubble.connect(gate).connect(pattern).connect(out); bubble.start();
      }
      const sizzle = noiseSource(c), hi = filter(c, 'highpass', 4500), hiss = c.createGain();
      hiss.gain.value = 0.06; wobble(c, hiss.gain, 0.9, 0.04);
      sizzle.connect(hi).connect(hiss).connect(out); sizzle.start();
    })),
    // Departamentos incendiados: la grabación del fuego (mientras carga, el rugido de las llamas y la madera
    // que cruje y chisporrotea).
    fire: channel(0.8, out => recorded(c, fuegoUrl, 1.3, out, out => {
      const roar = noiseSource(c), body = filter(c, 'lowpass', 600), level = c.createGain();
      level.gain.value = 0.85; wobble(c, level.gain, 2.3, 0.15);
      roar.connect(body).connect(level).connect(out); roar.start();
      const crackle = noiseSource(c), hi = filter(c, 'bandpass', 2800, 3), pops = c.createGain();
      pops.gain.value = 0.22; wobble(c, pops.gain, 11, 0.22, 'square'); wobble(c, pops.gain, 3.7, 0.12, 'square');
      crackle.connect(hi).connect(pops).connect(out); crackle.start();
    })),
    // Cortocircuitos: la grabación de la electricidad (mientras carga, un zumbido y chispazos que restallan).
    electric: channel(0.4, out => recorded(c, lavaElectricidadUrl, 1.5, out, out => {
      const hum = osc(c, 'sawtooth', 100), band = filter(c, 'bandpass', 900, 2), level = c.createGain();
      level.gain.value = 0.6; wobble(c, level.gain, 50, 0.3, 'square');
      hum.connect(band).connect(level).connect(out); hum.start();
      const arc = noiseSource(c), hi = filter(c, 'highpass', 3200), snap = c.createGain();
      snap.gain.value = 0.45; wobble(c, snap.gain, 17, 0.45, 'square'); wobble(c, snap.gain, 6.3, 0.3, 'square');
      arc.connect(hi).connect(snap).connect(out); arc.start();
    })),
    // Helicóptero: la grabación (mientras carga, el "chop-chop" de las palas, la turbina que silba y el motor).
    heli: channel(0.75, out => recorded(c, helicopteroUrl, 1.2, out, out => {
      const air = noiseSource(c), low = filter(c, 'lowpass', 700), chop = c.createGain();
      chop.gain.value = 0.5; wobble(c, chop.gain, 12, 0.5);
      air.connect(low).connect(chop).connect(out); air.start();
      const thump = osc(c, 'sine', 55), beat = c.createGain();
      beat.gain.value = 0.35; wobble(c, beat.gain, 12, 0.35);
      thump.connect(beat).connect(out); thump.start();
      const turbine = osc(c, 'sine', 2100), whine = c.createGain();
      whine.gain.value = 0.025; wobble(c, turbine.frequency, 0.3, 25);
      turbine.connect(whine).connect(out); turbine.start();
    })),
    // Gente prendida fuego: su propia grabación de fuego (mientras carga, un rugido de llamas sintetizado).
    burning: channel(0.7, out => recorded(c, lavaPersonaFuegoUrl, 1.2, out, out => {
      const roar = noiseSource(c), body = filter(c, 'lowpass', 700), level = c.createGain();
      level.gain.value = 0.7; wobble(c, level.gain, 3.1, 0.2);
      roar.connect(body).connect(level).connect(out); roar.start();
    })),
    // Sirena lejana: suena todo el tiempo, bajita y apagada (como a varias cuadras).
    siren: channel(0.09, out => recorded(c, lavaSirenaUrl, 1, out, () => { /* mientras carga, nada */ })),
    // Ascensor: la grabación del ascensor (mientras carga, el motor eléctrico que zumba y el cable que roza).
    elevator: channel(0.45, out => recorded(c, lavaAscensorUrl, 1.2, out, out => {
      const motor = osc(c, 'sawtooth', 82), low = filter(c, 'lowpass', 280), level = c.createGain();
      level.gain.value = 0.7; wobble(c, level.gain, 5, 0.12);
      motor.connect(low).connect(level).connect(out); motor.start();
      const cable = noiseSource(c), band = filter(c, 'bandpass', 650, 3), rub = c.createGain();
      rub.gain.value = 0.35;
      cable.connect(band).connect(rub).connect(out); cable.start();
    })),
  };
}
// levels: cuánto se escucha cada cosa (0 a 1); null apaga todo (pausa, fin de partida).
export function setLavaAmbient(levels: Record<LavaChannel, number> | null) {
  if (!ctx || (!lavaAmbient && !levels)) return;
  lavaAmbient ??= buildLavaAmbient(ctx);
  const t = ctx.currentTime;
  for (const name of LAVA_CHANNELS) {
    const { gain, max } = lavaAmbient[name];
    gain.gain.setTargetAtTime(levels ? levels[name] * max : 0, t, levels ? 0.1 : 0.03);
  }
}
// El ascensor llega a un piso: el "ding" de dos notas.
export function playElevatorDing(volume: number) {
  const c = running(); if (!c || volume <= 0.02) return;
  const t = c.currentTime;
  tone(c, 'sine', 1319, 1319, t, 0.9, 0.3 * volume);
  tone(c, 'sine', 1047, 1047, t + 0.28, 1.1, 0.3 * volume);
}
// Algo que se quema: un siseo fuerte que se apaga, chasquidos y el "fuuum" de la llamarada.
function sizzle(c: AudioContext, start: number, volume: number) {
  const hiss = noiseSource(c, false), hi = filter(c, 'highpass', 2600), gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.55 * volume, start + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.5);
  hiss.connect(hi).connect(gain).connect(out(c)); hiss.start(start); hiss.stop(start + 1.55);
  burst(c, 'lowpass', 700, start, 0.6, 0.6 * volume);
  for (let i = 0; i < 7; i++) burst(c, 'bandpass', 2500 + Math.random() * 2000, start + 0.05 + Math.random() * 1.1, 0.025, 0.4 * volume);
}
// El personaje cae en la lava: un grito, el "plop" espeso al hundirse y cómo se quema.
export function playLavaFall() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  scream(c, t);
  tone(c, 'sine', 140, 40, t + 0.15, 0.35, 0.7);
  sizzle(c, t + 0.15, 1);
}
// Una persona del juego alcanzada por la lava: grita (cada una con su voz) y se quema (la grabación, un poco
// más grave o más aguda según la persona; si todavía no cargó, el siseo sintetizado).
export function playPersonBurn(volume: number, pitch: number) {
  const c = running(); if (!c || volume <= 0.03) return;
  const t = c.currentTime;
  scream(c, t, pitch, 0.9 * volume);
  const buffer = samples.get(personaQuemaUrl);
  if (!(buffer instanceof AudioBuffer)) { loadSample(personaQuemaUrl); sizzle(c, t + 0.05, volume * 0.8); return; }
  const source = c.createBufferSource(), gain = c.createGain();
  source.buffer = buffer; source.playbackRate.value = 0.9 + (pitch - 0.8) * 0.35; gain.gain.value = 1.1 * volume;
  source.connect(gain).connect(out(c)); source.start(t + 0.05);
}

// ---------- Ciudad Tiburón ----------
let storm: Record<StormChannel, Channel> | null = null;
function buildStorm(c: AudioContext): Record<StormChannel, Channel> {
  const channel = (max: number, make: (out: GainNode) => void) => ambientChannel(c, max, make);
  return {
    // Lluvia: el siseo parejo del aguacero y gotas gruesas que golpean cerca.
    // Lluvia: la grabación (un tramo de 14 s que se repite sin que se note el corte); mientras carga, un
    // aguacero sintetizado.
    rain: channel(0.16, out => {
      const synth = c.createGain(); synth.connect(out);
      const shower = noiseSource(c), hi = filter(c, 'highpass', 500), low = filter(c, 'lowpass', 7000), level = c.createGain();
      level.gain.value = 0.8; wobble(c, level.gain, 0.23, 0.1);
      shower.connect(hi).connect(low).connect(level).connect(synth); shower.start();
      const drops = noiseSource(c), band = filter(c, 'bandpass', 3200, 2), patter = c.createGain();
      patter.gain.value = 0.3; wobble(c, patter.gain, 13, 0.2, 'square'); wobble(c, patter.gain, 7.7, 0.15, 'square');
      drops.connect(band).connect(patter).connect(synth); drops.start();
      whenLoaded(lluviaUrl, buffer => {
        const loop = c.createBufferSource(), level = c.createGain();
        loop.buffer = buffer; loop.loop = true; level.gain.value = 1.3;
        loop.connect(level).connect(out); loop.start();
        synth.gain.setTargetAtTime(0, c.currentTime, 0.3);
      });
    }),
    // Viento: un soplido grave que sube y baja, con un silbido entre los edificios.
    wind: channel(0.25, out => {
      const air = noiseSource(c), band = filter(c, 'bandpass', 480, 0.8), level = c.createGain();
      wobble(c, band.frequency, 0.17, 220);
      level.gain.value = 0.75; wobble(c, level.gain, 0.31, 0.25);
      air.connect(band).connect(level).connect(out); air.start();
      const whistle = noiseSource(c), tube = filter(c, 'bandpass', 1150, 9), soft = c.createGain();
      wobble(c, tube.frequency, 0.12, 260);
      soft.gain.value = 0.35; wobble(c, soft.gain, 0.21, 0.3);
      whistle.connect(tube).connect(soft).connect(out); whistle.start();
    }),
    // Agua en las calles: la corriente que corre, el chapoteo contra las paredes y algún gorgoteo.
    water: channel(0.45, out => {
      const flow = noiseSource(c), low = filter(c, 'lowpass', 850), level = c.createGain();
      level.gain.value = 0.75; wobble(c, level.gain, 1.3, 0.15);
      flow.connect(low).connect(level).connect(out); flow.start();
      const lap = noiseSource(c), band = filter(c, 'bandpass', 380, 1.5), slosh = c.createGain();
      slosh.gain.value = 0.4; wobble(c, slosh.gain, 0.55, 0.4);
      lap.connect(band).connect(slosh).connect(out); lap.start();
      const gurgle = osc(c, 'sine', 320), gate = c.createGain(), pattern = c.createGain();
      wobble(c, gurgle.frequency, 6, 140, 'sawtooth');
      gate.gain.value = 0.06; wobble(c, gate.gain, 6, 0.06, 'square');
      pattern.gain.value = 0.5; wobble(c, pattern.gain, 0.4, 0.5, 'square');
      gurgle.connect(gate).connect(pattern).connect(out); gurgle.start();
    }),
    // Hélice de los tiburones voladores: la grabación del helicóptero (mientras carga, el "chop-chop" de las
    // palas y el zumbido del motorcito).
    rotor: channel(2, out => recorded(c, helicopteroUrl, 1.3, out, out => {
      const air = noiseSource(c), low = filter(c, 'lowpass', 900), chop = c.createGain();
      chop.gain.value = 0.5; wobble(c, chop.gain, 16, 0.5);
      air.connect(low).connect(chop).connect(out); air.start();
      const motor = osc(c, 'sawtooth', 190), band = filter(c, 'lowpass', 1200), hum = c.createGain();
      hum.gain.value = 0.18; wobble(c, motor.frequency, 16, 12);
      motor.connect(band).connect(hum).connect(out); motor.start();
    })),
  };
}
export function setStormAmbient(levels: Record<StormChannel, number> | null) {
  if (!ctx || (!storm && !levels)) return;
  storm ??= buildStorm(ctx);
  const t = ctx.currentTime;
  for (const name of STORM_CHANNELS) {
    const { gain, max } = storm[name];
    gain.gain.setTargetAtTime(levels ? levels[name] * max : 0, t, levels ? 0.15 : 0.03);
  }
}
// Trueno: el chasquido del rayo y después un retumbo largo que rueda (más tarde y más grave si cayó lejos).
const TRUENOS = [trueno1Url, trueno2Url, trueno3Url];
export function preloadSharkSounds() { for (const url of [lluviaUrl, tiburonAtacaUrl, helicopteroUrl, ...TRUENOS]) loadSample(url); }
// Espera a que cargue una grabación y la entrega (si ya cargó, enseguida).
function whenLoaded(url: string, ready: (buffer: AudioBuffer) => void) {
  loadSample(url);
  const check = () => { const b = samples.get(url); if (b instanceof AudioBuffer) ready(b); else if (b) setTimeout(check, 250); };
  check();
}
// Trepaluna: el clima (la ciudad, la lluvia, el viento) y los truenos de la tormenta.
export function preloadTrepaSounds() { for (const url of [trepaCiudadUrl, trepaLluviaUrl, trepaVientoUrl, trepaHelicopteroUrl, trepaAvionUrl, trepaPalomasUrl, trepaAscensorUrl, trepaFuegoUrl, trepaGritoUrl, trepaPajarosUrl, trepaOvniUrl, pasosUrl, trepaLaserUrl, trepaEngranajeUrl, trepaEscalonesUrl, trepaAscensorTecUrl, trepaAbducidoUrl, trepaFuegoTecUrl, ...TRUENOS]) loadSample(url); }
// Un caño de fuego que se prende cerca: la llamarada grabada (más fuerte cuanto más cerca, near de 0 a 1).
let lastFlame = -1;
export function playFlame(near: number, tech = false) { // tech: los caños de fuego de la zona tecnológica
  const c = running(); if (!c || c.currentTime - lastFlame < 0.25) return;
  lastFlame = c.currentTime;
  playSample(tech ? trepaFuegoTecUrl : trepaFuegoUrl, 0.04 + near * 0.22);
}
// El imán agarra al trepador y se lo lleva para arriba.
export function playAbducted() { playSample(trepaAbducidoUrl, 0.8); }
export function playThunder(near: number) {
  // La grabación (uno de los tres truenos, al azar): más tarde y más bajo si el rayo cayó lejos.
  if (playSample(TRUENOS[Math.floor(Math.random() * TRUENOS.length)], 0.15 + near * 0.2, (1 - near) * 0.5)) return;
  const c = running(); if (!c) return;
  const t = c.currentTime + (1 - near) * 0.5;
  if (near > 0.4) { burst(c, 'highpass', 1800, t, 0.12, 0.6 * near); burst(c, 'lowpass', 3000, t, 0.25, 0.7 * near); }
  for (let i = 0; i < 4; i++) {
    const start = t + 0.05 + i * (0.25 + Math.random() * 0.35), length = 1.6 + Math.random() * 1.4;
    const rumble = noiseSource(c, false), low = filter(c, 'lowpass', 130 + near * 120 + Math.random() * 60), gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime((0.9 - i * 0.15) * (0.5 + near * 0.5), start + 0.08 + Math.random() * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    rumble.connect(low).connect(gain).connect(out(c)); rumble.start(start); rumble.stop(start + length + 0.05);
  }
}
// Pasos mojados: el golpe del pie y el chapoteo del agua en el piso.
let wetSide = 0;
export function playWetStep() {
  const c = running(); if (!c) return;
  wetSide = 1 - wetSide;
  const t = c.currentTime, f = wetSide ? 140 : 165;
  tone(c, 'sine', f, f * 0.6, t, 0.07, 0.3);
  burst(c, 'bandpass', 2200 + Math.random() * 800, t + 0.01, 0.07, 0.22);
}
// Algo cae al agua (el bombero o un tiburón que vuelve a zambullirse).
export function playSplash(size: number) {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sine', 220, 70, t, 0.18, 0.4 * size);
  burst(c, 'lowpass', 1800, t, 0.45 * size + 0.15, 0.6 * size);
  for (let i = 0; i < 4; i++) burst(c, 'bandpass', 1500 + Math.random() * 1500, t + 0.08 + Math.random() * 0.3, 0.04, 0.2 * size);
}
// Rescate: una campanita alegre que sube.
export function playRescue() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  [784, 988, 1175, 1568].forEach((f, i) => { tone(c, 'triangle', f, f, t + i * 0.08, 0.3, 0.32); tone(c, 'sine', f * 2, f * 2, t + i * 0.08, 0.2, 0.06); });
}
// El tiburón salta del agua: el "fuush" del agua que se abre y la ola que salpica.
export function playSharkLeap() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  const rush = noiseSource(c, false), band = filter(c, 'bandpass', 300, 1.2), gain = c.createGain();
  band.frequency.setValueAtTime(300, t); band.frequency.exponentialRampToValueAtTime(1600, t + 0.35);
  gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.9, t + 0.05); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  rush.connect(band).connect(gain).connect(out(c)); rush.start(t); rush.stop(t + 0.65);
  tone(c, 'sine', 160, 50, t, 0.3, 0.6);
  for (let i = 0; i < 6; i++) burst(c, 'bandpass', 1800 + Math.random() * 2000, t + 0.1 + Math.random() * 0.45, 0.04, 0.25);
}
// El tiburón muerde: el golpe de la mandíbula y el chapoteo. who: el bombero o alguien que flotaba (las
// personas gritan; los perros y los gatos no). volume: según lo lejos que pase.
export function playSharkBite(who: 'player' | 'persona' | 'animal', volume = 1, pitch = 1) {
  const c = running(); if (!c || volume <= 0.03) return;
  const t = c.currentTime;
  if (!playSample(tiburonAtacaUrl, 0.9 * volume)) { // la grabación del ataque; mientras carga, uno sintetizado
    tone(c, 'sine', 120, 45, t, 0.2, 0.8 * volume);
    burst(c, 'bandpass', 900, t, 0.09, 0.6 * volume);
    burst(c, 'lowpass', 1500, t + 0.05, 0.4, 0.45 * volume);
  }
  if (who !== 'animal') scream(c, t + 0.02, who === 'player' ? 0.8 : pitch, 0.9 * volume);
}
// Un tiburón volador te vio: tres pitidos de alarma del aparato.
export function playFlyerWarn() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 3; i++) tone(c, 'square', 1250, 1250, t + i * 0.16, 0.1, 0.22);
}
// Se tira en picada: un silbido que baja de tono y el viento que corta.
export function playFlyerDive() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sine', 1400, 380, t, 0.7, 0.3);
  const rush = noiseSource(c, false), band = filter(c, 'bandpass', 1500, 1), gain = c.createGain();
  band.frequency.setValueAtTime(1500, t); band.frequency.exponentialRampToValueAtTime(400, t + 0.6);
  gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.6, t + 0.1); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  rush.connect(band).connect(gain).connect(out(c)); rush.start(t); rush.stop(t + 0.75);
}

// ---------- Solitario 3.000 ----------
// Dar vuelta una carta del mazo: el roce del cartón al deslizarse y el golpecito al caer.
export function playCardFlip() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  const swish = noiseSource(c, false), band = filter(c, 'bandpass', 2600, 1.2), gain = c.createGain();
  band.frequency.setValueAtTime(1800, t); band.frequency.exponentialRampToValueAtTime(4200, t + 0.08);
  gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.35, t + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  swish.connect(band).connect(gain).connect(out(c)); swish.start(t); swish.stop(t + 0.13);
  burst(c, 'lowpass', 1200, t + 0.09, 0.04, 0.4);
}
// Volver a armar el mazo: varias cartas que se juntan rápido.
export function playShuffle() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 7; i++) burst(c, 'bandpass', 2500 + Math.random() * 1500, t + i * 0.035, 0.05, 0.25);
}
// Una carta sobre otra: la grabación de la carta; mientras carga, un chispazo eléctrico corto.
export function playCardZap() {
  if (playSample(cartaUrl, 0.9)) return;
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sawtooth', 900, 140, t, 0.16, 0.14);
  const arc = noiseSource(c, false), hi = filter(c, 'highpass', 3000), gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.3, t + 0.005); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  wobble(c, gain.gain, 45, 0.2, 'square');
  arc.connect(hi).connect(gain).connect(out(c)); arc.start(t); arc.stop(t + 0.2);
  burst(c, 'lowpass', 900, t, 0.05, 0.35); // el golpe de la carta
}
// Un as en las bases: una campana (un tono con sus armónicos que se apaga despacio).
export function playBell() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  for (const [mult, volume, length] of [[1, 0.35, 1.8], [2.76, 0.16, 1.2], [5.4, 0.08, 0.7], [8.93, 0.04, 0.4]]) tone(c, 'sine', 880 * mult, 880 * mult, t, length, volume);
  burst(c, 'highpass', 5000, t, 0.02, 0.15); // el golpe del badajo
}
// Las grabaciones de Solitario 3.000 (mientras cargan suenan los sintetizados de arriba).
const SOLITAIRE = [victoriaUrl, cartaUrl, cartaSobreCartaUrl, cartaArribaUrl, paloCompletoUrl, mazoVacioUrl, mazoReiniciaUrl, cartaMazoUrl, cartaAsUrl, columnaLibreUrl, solitarioGanasteUrl];
export function preloadSolitaireSounds() { for (const url of SOLITAIRE) loadSample(url); }
// Sacar una carta del mazo (tocando el 3.000).
export function playDrawCard() { if (!playSample(cartaMazoUrl, 0.9)) playCardFlip(); }
// Una carta sobre otra carta de las columnas.
export function playCardOnCard() { if (!playSample(cartaSobreCartaUrl, 0.9)) playCardZap(); }
// Una carta en las bases de arriba (el as tiene su campana y el palo completo, su festejo).
export function playCardUp() { if (!playSample(cartaArribaUrl, 0.9)) playCardFlip(); }
export function playAceUp() { if (!playSample(cartaAsUrl, 0.9)) playBell(); }
export function playSuitDone() { if (!playSample(paloCompletoUrl, 0.85)) playBell(); }
// El mazo se quedó sin cartas, y cuando se vuelve a armar.
export function playStockEmpty() { playSample(mazoVacioUrl, 0.8); }
export function playStockReset() { if (!playSample(mazoReiniciaUrl, 0.9)) playShuffle(); }
// Se liberó una columna (ahí se puede poner un Rey): la grabación; mientras carga, un "fiu" y un tintineo.
export function playColumnFree() {
  if (playSample(columnaLibreUrl, 0.9)) return;
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'triangle', 420, 1260, t, 0.22, 0.22);
  tone(c, 'sine', 1568, 1568, t + 0.16, 0.5, 0.16);
  tone(c, 'sine', 2093, 2093, t + 0.24, 0.6, 0.12);
}
export function playVictory() { if (!playSample(victoriaUrl, 0.85)) playWin(); }
// Ganar el Solitario 3.000: su propia música de festejo.
export function playSolitaireWin() { if (!playSample(solitarioGanasteUrl, 0.85)) playWinFanfare(); }

// ---------- ¡Huye de la serpiente! ----------
// Los pasitos de la manzana: un golpecito suave y agudo, alternando un pie y el otro.
let appleSide = 0;
export function playAppleStep() {
  const c = running(); if (!c) return;
  appleSide = 1 - appleSide;
  const t = c.currentTime, f = appleSide ? 520 : 600;
  tone(c, 'sine', f, f * 0.55, t, 0.05, 0.16);
  burst(c, 'bandpass', 2400, t, 0.025, 0.08);
}
// La serpiente se come una manzana: el mordiscón crocante y el "glup" al tragar.
export function playSnakeEat() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 4; i++) burst(c, 'bandpass', 2200 + Math.random() * 1800, t + i * 0.045, 0.05, 0.45);
  burst(c, 'lowpass', 900, t, 0.08, 0.5);
  tone(c, 'sine', 260, 90, t + 0.22, 0.18, 0.5);
}

// ---------- Tiki-Taka ----------
export function preloadSoccerSounds() { for (const url of [golUrl, hinchadaUrl, patadaUrl]) loadSample(url); }
// Una patada a la pelota (pase, tiro o pase del rival): la grabación; mientras carga, un golpe sintetizado.
export function playKick(volume = 1) {
  const c = running(); if (!c) return;
  // La hinchada baja un instante para que la pelota se escuche bien.
  if (crowd) { const t = c.currentTime; crowd.gain.cancelScheduledValues(t); crowd.gain.setTargetAtTime(crowdLevel * 0.35, t, 0.01); crowd.gain.setTargetAtTime(crowdLevel, t + 0.25, 0.15); }
  tone(c, 'sine', 150, 60, c.currentTime, 0.12, 0.7 * volume); // el golpe grave del pie contra la pelota
  if (!playSample(patadaUrl, 2.5 * volume)) burst(c, 'bandpass', 1500, c.currentTime, 0.06, 0.6 * volume);
}
// ¡Gol!: la grabación del festejo (y la hinchada se levanta un rato).
export function playGoal() {
  playSample(golUrl, 0.9);
  if (crowd && ctx) { const t = ctx.currentTime; crowd.gain.cancelScheduledValues(t); crowd.gain.setTargetAtTime(0.55, t, 0.2); crowd.gain.setTargetAtTime(crowdLevel, t + 4, 1); }
}
// El silbato del árbitro: un pitazo largo para sacar del medio, dos al terminar el primer tiempo, tres
// (el último bien largo) al final del partido y uno corto y seco para dar la orden de patear un penal.
export function playRefWhistle(kind: 'kickoff' | 'half' | 'end' | 'penalty') {
  playWhistle(kind === 'kickoff' ? [[0, 0.6]] : kind === 'half' ? [[0, 0.35], [0.45, 0.9]] : kind === 'penalty' ? [[0, 0.42]] : [[0, 0.3], [0.4, 0.3], [0.8, 1.2]]);
}
// La hinchada de fondo: la grabación en bucle; level 0 la apaga.
let crowd: GainNode | null = null, crowdLevel = 0;
export function setCrowd(level: number) {
  if (!ctx) return;
  if (!crowd) {
    const c = ctx, gain = c.createGain();
    gain.gain.value = 0; gain.connect(out(c)); crowd = gain;
    whenLoaded(hinchadaUrl, buffer => {
      const loop = c.createBufferSource(); loop.buffer = buffer; loop.loop = true;
      loop.loopStart = 0.03; loop.loopEnd = buffer.duration - 0.03; // sin el silencito que el mp3 deja en las puntas
      loop.connect(gain); loop.start(0, 0.03);
    });
  }
  if (level * 0.22 === crowdLevel) return; // solo cuando cambia (así no pisa el festejo de un gol)
  crowdLevel = level * 0.22;
  crowd.gain.cancelScheduledValues(ctx.currentTime);
  crowd.gain.setTargetAtTime(crowdLevel, ctx.currentTime, 0.4);
}

// ---------- Invasión ----------
let invasionAmbient: Record<InvasionChannel, Channel> | null = null;
export function preloadInvasionSounds() { for (const url of [fuegoUrl, lluviaUrl, ...TRUENOS, invTiroUrl, invSangreAlienUrl, invSangreHumanoUrl, invBombaUrl, invAutosUrl, invPajarosUrl, invPersonasUrl, invOvniUrl, invOvniDisparoUrl, invAlienHablaUrl, invLluviaUrl]) loadSample(url); }
// Voces en un idioma inventado: una voz (tono que sube y baja) que pasa por dos "formantes" que cambian todo
// el tiempo (las vocales) y se corta en sílabas.
function babble(c: AudioContext, out: AudioNode, pitch: number, rate: number) {
  const voice = osc(c, 'sawtooth', pitch), level = c.createGain(), syl = c.createGain();
  wobble(c, voice.frequency, 0.7 + rate * 0.1, pitch * 0.18); wobble(c, voice.frequency, 3.1, pitch * 0.06);
  const f1 = filter(c, 'bandpass', 600, 5), f2 = filter(c, 'bandpass', 1500, 6);
  wobble(c, f1.frequency, rate * 0.9, 260, 'square'); wobble(c, f2.frequency, rate * 1.3, 600, 'triangle');
  syl.gain.value = 0.5; wobble(c, syl.gain, rate, 0.5, 'square'); wobble(c, syl.gain, rate * 0.23, 0.35, 'square');
  level.gain.value = 0.35;
  voice.connect(f1).connect(syl); voice.connect(f2).connect(syl); syl.connect(level).connect(out); voice.start();
}
function buildInvasionAmbient(c: AudioContext): Record<InvasionChannel, Channel> {
  const channel = (max: number, make: (out: GainNode) => void) => ambientChannel(c, max, make);
  return {
    // La ciudad: la grabación de los autos (mientras carga, el rumor del tránsito y alguna bocina lejana).
    city: channel(0.55, out => recorded(c, invAutosUrl, 1, out, out => {
      const traffic = noiseSource(c), low = filter(c, 'lowpass', 380), level = c.createGain();
      level.gain.value = 0.7; wobble(c, level.gain, 0.13, 0.35); wobble(c, low.frequency, 0.21, 160);
      traffic.connect(low).connect(level).connect(out); traffic.start();
      const horn = osc(c, 'square', 415), hornF = filter(c, 'lowpass', 1400), hornGate = c.createGain();
      hornGate.gain.value = 0; wobble(c, hornGate.gain, 0.09, 0.04, 'square');
      horn.connect(hornF).connect(hornGate).connect(out); horn.start();
    })),
    // Pájaros: la grabación (mientras carga, trinos cortos que suben y bajan).
    birds: channel(0.4, out => recorded(c, invPajarosUrl, 1, out, out => {
      for (const [f, rate] of [[3200, 5.3], [4100, 7.1], [2700, 3.7]]) {
        const tw = osc(c, 'sine', f), gate = c.createGain(), phrase = c.createGain();
        wobble(c, tw.frequency, rate * 3, f * 0.18, 'sawtooth');
        gate.gain.value = 0.3; wobble(c, gate.gain, rate, 0.3, 'square');
        phrase.gain.value = 0.5; wobble(c, phrase.gain, rate * 0.11, 0.5, 'square');
        tw.connect(gate).connect(phrase).connect(out); tw.start();
      }
    })),
    // Gente hablando: la grabación (mientras carga, voces en un idioma inventado, una grave y una aguda).
    voices: channel(0.6, out => recorded(c, invPersonasUrl, 1, out, out => { babble(c, out, 125, 4.7); babble(c, out, 215, 5.9); })),
    // La tele: voces que salen por un parlante chico, con música de fondo.
    tv: channel(0.35, out => {
      const tinny = filter(c, 'bandpass', 1800, 1.2); tinny.connect(out);
      babble(c, tinny, 170, 6.4);
      const tune = osc(c, 'triangle', 330), tl = c.createGain(); tl.gain.value = 0.08; wobble(c, tune.frequency, 1.2, 60, 'square');
      tune.connect(tl).connect(tinny); tune.start();
    }),
    // La cocina: algo que se fríe en la sartén.
    kitchen: channel(0.3, out => {
      const sizzle = noiseSource(c), hi = filter(c, 'highpass', 3800), level = c.createGain();
      level.gain.value = 0.5; wobble(c, level.gain, 13, 0.25, 'square'); wobble(c, level.gain, 2.9, 0.15);
      sizzle.connect(hi).connect(level).connect(out); sizzle.start();
    }),
    // Música (el bar, la radio): unos acordes con ritmo.
    music: channel(0.3, out => {
      const beat = c.createGain(); beat.gain.value = 0.25; wobble(c, beat.gain, 2.1, 0.25, 'square'); beat.connect(out);
      for (const f of [196, 247, 294, 392]) { const o = osc(c, 'triangle', f); wobble(c, o.frequency, 0.26, f * 0.12, 'square'); o.connect(beat); o.start(); }
      const bass = osc(c, 'sine', 98), bl = c.createGain(); bl.gain.value = 0.4; wobble(c, bass.frequency, 1.05, 24, 'square'); bass.connect(bl).connect(beat); bass.start();
    }),
    // La obra: martillazos y una amoladora de fondo.
    work: channel(0.4, out => {
      const hit = noiseSource(c), band = filter(c, 'bandpass', 1500, 4), gate = c.createGain();
      gate.gain.value = 0.4; wobble(c, gate.gain, 2.6, 0.4, 'square');
      hit.connect(band).connect(gate).connect(out); hit.start();
      const grinder = osc(c, 'sawtooth', 2400), gl = c.createGain(); gl.gain.value = 0.02; wobble(c, gl.gain, 0.15, 0.02, 'square');
      grinder.connect(gl).connect(out); grinder.start();
    }),
    // El gimnasio: los pasos en la cinta y las pesas.
    gym: channel(0.3, out => {
      const thump = osc(c, 'sine', 70), gate = c.createGain(); gate.gain.value = 0.4; wobble(c, gate.gain, 2.8, 0.4, 'square');
      thump.connect(gate).connect(out); thump.start();
    }),
    // Fuego: la grabación (mientras carga, un rugido con chisporroteo).
    fire: channel(0.8, out => recorded(c, fuegoUrl, 1.3, out, out => {
      const roar = noiseSource(c), body = filter(c, 'lowpass', 600), level = c.createGain();
      level.gain.value = 0.85; wobble(c, level.gain, 2.3, 0.15);
      roar.connect(body).connect(level).connect(out); roar.start();
    })),
    // Ovnis: un zumbido grave que vibra y un silbido agudo.
    ufo: channel(1, out => recorded(c, invOvniUrl, 1.2, out, out => {
      const hum = osc(c, 'sawtooth', 48), low = filter(c, 'lowpass', 260), level = c.createGain();
      level.gain.value = 0.8; wobble(c, hum.frequency, 0.6, 6); wobble(c, level.gain, 7, 0.25);
      hum.connect(low).connect(level).connect(out); hum.start();
      const whine = osc(c, 'sine', 1900), wl = c.createGain(); wl.gain.value = 0.05; wobble(c, whine.frequency, 0.9, 220);
      whine.connect(wl).connect(out); whine.start();
    })),
    // El tic-tac de una caja con explosivos.
    tick: channel(0.35, out => {
      const tk = osc(c, 'square', 2600), gate = c.createGain(); gate.gain.value = 0; wobble(c, gate.gain, 2, 0.5, 'square');
      const hp = filter(c, 'highpass', 2000), short = c.createGain(); short.gain.value = 0.3; wobble(c, short.gain, 20, 0.3, 'square');
      tk.connect(hp).connect(gate).connect(short).connect(out); tk.start();
    }),
    // La lluvia: la grabación (mientras carga, un ruido suave y agudo).
    rain: channel(0.7, out => recorded(c, invLluviaUrl, 1, out, out => {
      const drops = noiseSource(c), hi = filter(c, 'highpass', 1800), level = c.createGain();
      level.gain.value = 0.35; wobble(c, level.gain, 0.2, 0.08);
      drops.connect(hi).connect(level).connect(out); drops.start();
    })),
    // Perros que ladran.
    dog: channel(0.3, out => {
      const bark = noiseSource(c), band = filter(c, 'bandpass', 700, 3), gate = c.createGain();
      gate.gain.value = 0; wobble(c, gate.gain, 1.7, 0.6, 'square'); wobble(c, gate.gain, 0.4, 0.4, 'square');
      bark.connect(band).connect(gate).connect(out); bark.start();
    }),
  };
}
export function setInvasionAmbient(levels: Record<InvasionChannel, number> | null) {
  if (!ctx || (!invasionAmbient && !levels)) return;
  invasionAmbient ??= buildInvasionAmbient(ctx);
  const t = ctx.currentTime;
  for (const name of INVASION_CHANNELS) {
    const { gain, max } = invasionAmbient[name];
    gain.gain.setTargetAtTime(levels ? levels[name] * max : 0, t, levels ? 0.12 : 0.03);
  }
}
// El disparo del rifle: un estampido seco con un eco que se va por la calle.
export function playRifleShot() {
  if (playSample(invTiroUrl, 0.9)) return;
  const c = running(); if (!c) return;
  const t = c.currentTime;
  burst(c, 'lowpass', 5000, t, 0.12, 1.2);
  tone(c, 'sine', 140, 40, t, 0.35, 1.1);
  for (const [d, v] of [[0.18, 0.25], [0.42, 0.12], [0.75, 0.06]]) burst(c, 'lowpass', 1200, t + d, 0.35, v);
}
// El cerrojo: dos clics metálicos (atrás y adelante).
export function playBolt() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  burst(c, 'highpass', 3000, t + 0.12, 0.05, 0.35); tone(c, 'square', 900, 700, t + 0.12, 0.05, 0.08);
  burst(c, 'highpass', 2500, t + 0.38, 0.06, 0.4); tone(c, 'square', 600, 500, t + 0.38, 0.06, 0.1);
}
// Recarga: el cargador que sale, el nuevo que entra y el cerrojo.
export function playReload() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  for (const d of [0.1, 0.9, 1.6, 1.85]) { burst(c, 'bandpass', 1800, t + d, 0.07, 0.35); tone(c, 'square', 500, 380, t + d, 0.06, 0.06); }
}
export function playEmpty() { const c = running(); if (!c) return; burst(c, 'highpass', 3500, c.currentTime, 0.03, 0.3); }
// Vidrio que se rompe.
export function playGlass(volume = 1) {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 9; i++) { const d = Math.random() * 0.35; tone(c, 'sine', 2500 + Math.random() * 3500, 2000 + Math.random() * 2000, t + d, 0.12, 0.08 * volume); burst(c, 'highpass', 4000, t + d, 0.05, 0.15 * volume); }
}
// El alien que muere: un chillido que baja y un gorgoteo.
export function playAlienDeath(volume = 1) {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sawtooth', 1400, 180, t, 0.7, 0.35 * volume);
  tone(c, 'square', 900, 120, t + 0.05, 0.6, 0.12 * volume);
  for (let i = 0; i < 5; i++) tone(c, 'sine', 160 + Math.random() * 120, 80, t + 0.4 + i * 0.08, 0.08, 0.2 * volume);
}
// El alien que explota: un golpe sordo y un chapoteo viscoso.
export function playGooBlast() {
  if (playSample(invSangreAlienUrl, 1)) return;
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sine', 120, 35, t, 0.45, 0.9);
  burst(c, 'lowpass', 900, t, 0.35, 0.7);
  for (let i = 0; i < 6; i++) tone(c, 'sine', 300 + Math.random() * 400, 90, t + 0.08 + i * 0.05, 0.1, 0.18);
}
// Le pegaste a una persona: un grito.
export function playCivilianHit(volume = 1) { playSample(invSangreHumanoUrl, volume); const c = running(); if (!c) return; scream(c, c.currentTime + 0.05, 1, 0.5 * volume); }
// Un grito de la gente que corre.
export function playScream(volume: number, pitch: number) { const c = running(); if (!c || volume < 0.05) return; scream(c, c.currentTime, pitch, 0.5 * volume); }
// La bala rebota en un ovni: un "ping" metálico.
export function playRicochet() { const c = running(); if (!c) return; tone(c, 'sine', 2600, 3400, c.currentTime, 0.4, 0.3); tone(c, 'triangle', 5200, 4100, c.currentTime + 0.02, 0.3, 0.1); }
// Bomba desactivada: unos pitidos que bajan.
export function playDefuse() { const c = running(); if (!c) return; const t = c.currentTime; [1760, 1320, 880].forEach((f, i) => tone(c, 'square', f, f, t + i * 0.12, 0.1, 0.15)); }
// Una explosión, más fuerte cuanto más cerca de la mira.
export function playBlast(volume: number) {
  if (volume < 0.05) return;
  if (playSample(invBombaUrl, volume)) return;
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sine', 90, 28, t, 0.6, 1.1 * volume);
  burst(c, 'lowpass', 1500, t, 0.8, 0.9 * volume);
}
// Un alien que habla (en su idioma): si se escucha esta voz cerca de la mira, ahí hay un alien.
export function playAlienTalk(volume: number) { if (volume >= 0.05) playSample(invAlienHablaUrl, volume, 0, 0.9 + Math.random() * 0.25); }
// El intercomunicador de los aliens: pitidos que suben y bajan y una voz metálica que tartamudea.
export function playAlienComm(volume: number) {
  const c = running(); if (!c || volume < 0.05) return;
  const t = c.currentTime;
  for (let i = 0; i < 6; i++) tone(c, 'square', 700 + Math.random() * 900, 400 + Math.random() * 1400, t + i * 0.11, 0.09, 0.07 * volume);
  for (let i = 0; i < 4; i++) tone(c, 'sawtooth', 180 + i * 35, 120 + Math.random() * 200, t + 0.7 + i * 0.22, 0.18, 0.1 * volume);
  burst(c, 'bandpass', 2500, t + 1.6, 0.25, 0.12 * volume);
}
// El rayo de un ovni: un "zap" que baja.
export function playLaser(volume: number) {
  if (volume < 0.03) return;
  if (playSample(invOvniDisparoUrl, volume)) return;
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sawtooth', 2200, 120, t, 0.9, 0.3 * volume);
  tone(c, 'square', 1100, 60, t + 0.05, 0.8, 0.12 * volume);
}
// Llega un ovni: una bocina grave que retumba.
export function playUfoArrive() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  for (const f of [55, 82.5]) tone(c, 'sawtooth', f, f * 0.98, t, 2.2, 0.35);
  tone(c, 'sine', 440, 220, t + 0.3, 1.6, 0.1);
}
// El encendedor de un alien (clic y la llama) o su arma (un silbido que sube).
export function playLighter(volume: number) { const c = running(); if (!c || volume < 0.05) return; const t = c.currentTime; burst(c, 'highpass', 3000, t, 0.03, 0.3 * volume); burst(c, 'bandpass', 900, t + 0.05, 0.5, 0.25 * volume); }
export function playRayGun(volume: number) { const c = running(); if (!c || volume < 0.05) return; tone(c, 'sine', 300, 2400, c.currentTime, 0.5, 0.25 * volume); }
// Más aliens: el aviso de la radio del francotirador.
export function playRadioBeep() { const c = running(); if (!c) return; const t = c.currentTime; burst(c, 'bandpass', 2000, t, 0.25, 0.15); tone(c, 'sine', 1200, 1200, t + 0.05, 0.1, 0.15); tone(c, 'sine', 1200, 1200, t + 0.2, 0.1, 0.15); }

// ---------- Para todos los juegos ----------
// Al tocar "Jugar" (o "Jugar de nuevo"): activa el audio y suena la grabación de "Jugar".
export function playStart() {
  unlockSounds();
  whenRunning(() => { playSample(jugarUrl, 0.8); });
}
// Al ganar: la grabación de la victoria (mientras carga, un acorde que sube).
export function playWinFanfare() {
  whenRunning(() => { if (!playSample(ganasteUrl, 0.9)) playWin(); });
}
// Se cargan apenas se abre un juego, así suenan desde el primer clic.
export function preloadUiSounds() { for (const url of [jugarUrl, ganasteUrl, gameOverUrl]) loadSample(url); }
if (typeof window !== 'undefined' && typeof fetch === 'function') preloadUiSounds();

// ---------- Gravity Swap ----------
export function preloadGravitySounds() { for (const url of [bombaUrl, propulsorUrl, personaCaeUrl, agujeroNegroUrl, laserUrl, monstruoUrl, puertaUrl, explosionUrl, pasosUrl, musicaGravedadUrl, gusanoUrl, trepaFuegoUrl, ...TRUENOS]) loadSample(url); }
// La gravedad se dio vuelta: un "fuuiiip" que sube y un soplido.
export function playGravityFlip() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sine', 180, 1400, t, 0.45, 0.4);
  tone(c, 'triangle', 90, 700, t, 0.45, 0.25);
  burst(c, 'bandpass', 1200, t, 0.35, 0.3);
}
export function playAstronautLand() { const c = running(); if (!c) return; burst(c, 'lowpass', 500, c.currentTime, 0.1, 0.5); }
// Láser que se prende: un zumbido eléctrico corto.
// Pasos del astronauta: la grabación trae muchas pisadas seguidas; cada paso suena una distinta (en orden).
const STEPS = [0.6, 1.12, 1.67, 2.2, 2.78, 3.34, 3.94, 4.5, 5.02, 5.56, 6.11, 6.64, 7.15, 7.67, 8.22, 8.79, 9.33, 9.85, 10.41, 11.01];
let stepIndex = 0;
export function playAstronautStep() {
  const c = running(); if (!c) return;
  const buffer = samples.get(pasosUrl);
  if (!(buffer instanceof AudioBuffer)) { loadSample(pasosUrl); return; }
  const source = c.createBufferSource(), gain = c.createGain();
  source.buffer = buffer; source.playbackRate.value = 0.95 + Math.random() * 0.1; gain.gain.value = 0.2;
  source.connect(gain).connect(out(c));
  source.start(c.currentTime, STEPS[stepIndex] - 0.02, 0.3);
  stepIndex = (stepIndex + 1) % STEPS.length;
}
// Pasos del trepador de Trepaluna: la misma grabación de pisadas, una distinta en cada paso.
let trepaStep = 0;
export function playTrepaStep() {
  const c = running(); if (!c) return;
  const buffer = samples.get(pasosUrl);
  if (!(buffer instanceof AudioBuffer)) { loadSample(pasosUrl); return; }
  const source = c.createBufferSource(), gain = c.createGain();
  source.buffer = buffer; source.playbackRate.value = 1.02 + Math.random() * 0.1; gain.gain.value = 0.32;
  source.connect(gain).connect(out(c));
  source.start(c.currentTime, STEPS[trepaStep] - 0.02, 0.28);
  trepaStep = (trepaStep + 1) % STEPS.length;
}
// Música de Gravity Swap: suena al empezar y, cada vez que termina, vuelve a sonar 10 segundos después.
// Se corta en la pausa y al perder (al seguir, arranca de nuevo al rato).
let music: AudioBufferSourceNode | null = null, musicGain: GainNode | null = null, musicNext = 0;
export function tickGravityMusic(on: boolean) {
  const c = running(); if (!c) return;
  if (!on) {
    if (music && musicGain) { musicGain.gain.setTargetAtTime(0, c.currentTime, 0.1); music.onended = null; music.stop(c.currentTime + 0.5); }
    music = null; musicGain = null; musicNext = 0;
    return;
  }
  if (!musicNext) musicNext = c.currentTime + 1;
  if (music || c.currentTime < musicNext) return;
  const buffer = samples.get(musicaGravedadUrl);
  if (!(buffer instanceof AudioBuffer)) { loadSample(musicaGravedadUrl); return; }
  const source = c.createBufferSource(), gain = c.createGain();
  source.buffer = buffer; gain.gain.value = 0.3;
  source.connect(gain).connect(out(c)); source.start();
  source.onended = () => { if (music === source) { music = null; musicGain = null; musicNext = c.currentTime + 10; } };
  music = source; musicGain = gain;
}
// Explosión de Gravity Swap: la grabación (si explotan varias juntas, no se amontonan).
let lastBoom = -1;
export function playGravityBoom() {
  const c = running(); if (!c) return;
  if (c.currentTime - lastBoom < 0.12) return;
  lastBoom = c.currentTime;
  if (!playSample(explosionUrl, 0.8)) playExplosion();
}
// La cuenta regresiva de la bomba: un pitido electrónico por número (el 1, más agudo y doble).
export function playBombBeep(count: number) {
  const c = running(); if (!c) return;
  const t = c.currentTime, f = count === 1 ? 1760 : count === 2 ? 1320 : 1100;
  tone(c, 'square', f, f, t, 0.09, 0.12);
  if (count === 1) tone(c, 'square', f, f, t + 0.14, 0.09, 0.12);
}
// Si hay varios lásers prendiéndose juntos, suena uno solo.
let lastLaser = -1;
export function playLaserOn() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  if (t - lastLaser < 0.25) return;
  lastLaser = t;
  if (playSample(laserUrl, 0.45)) return; // la grabación del láser
  tone(c, 'sawtooth', 900, 1500, t, 0.12, 0.08); burst(c, 'highpass', 4000, t, 0.06, 0.08);
}
// Puerta: la grabación trae varios golpes mecánicos de casi un segundo; uno suena al abrirse y otro al cerrarse.
let lastDoor = -1;
export function playDoor(opening: boolean) {
  const c = running(), buffer = samples.get(puertaUrl);
  if (!c || c.currentTime - lastDoor < 0.3) return;
  lastDoor = c.currentTime;
  if (!(buffer instanceof AudioBuffer)) { loadSample(puertaUrl); burst(c, 'lowpass', 700, c.currentTime, 0.3, 0.3); return; }
  const source = c.createBufferSource(), gain = c.createGain();
  source.buffer = buffer; gain.gain.value = 0.55;
  source.connect(gain).connect(out(c));
  if (opening) source.start(c.currentTime, 0.2, 0.65); else source.start(c.currentTime, 1.1, 0.75);
}
// Agujero negro: un ambiente grabado que suena en loop mientras hay uno cerca ("level" de 0 a 1: más fuerte
// cuanto más cerca). Se saltean el principio y el final de la grabación, que suben y bajan de a poco.
let hole: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
export function setBlackholeSound(level: number) {
  const c = running();
  if (!c) return;
  if (!hole) {
    if (level <= 0) return;
    const buffer = samples.get(agujeroNegroUrl);
    if (!(buffer instanceof AudioBuffer)) { loadSample(agujeroNegroUrl); return; }
    const source = c.createBufferSource(), gain = c.createGain();
    source.buffer = buffer; source.loop = true; source.loopStart = 4; source.loopEnd = Math.min(buffer.duration, 24);
    gain.gain.value = 0;
    source.connect(gain).connect(out(c)); source.start(0, 4);
    hole = { source, gain };
  }
  hole.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.8, c.currentTime, 0.15);
}
export function stopBlackholeSound() {
  const c = running();
  if (hole && c) { hole.gain.gain.setTargetAtTime(0, c.currentTime, 0.05); hole.source.stop(c.currentTime + 0.4); }
  hole = null;
}
export function playTurretShot() { const c = running(); if (!c) return; tone(c, 'square', 1400, 300, c.currentTime, 0.14, 0.14); }
// Al morir: un golpe húmedo, un chapoteo de sangre y un tono que baja.
export function playAstronautHit() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  burst(c, 'lowpass', 1500, t, 0.25, 0.8);
  burst(c, 'bandpass', 700, t + 0.03, 0.3, 0.55); // chapoteo
  tone(c, 'square', 600, 70, t + 0.05, 0.6, 0.25);
}
export function playGust() { const c = running(); if (!c) return; burst(c, 'bandpass', 500, c.currentTime, 1.4, 0.35); }
// El chorro de oxígeno (de respaldo, mientras carga la grabación): un soplido corto que suena seguido.
export function playThrust() { const c = running(); if (!c) return; burst(c, 'bandpass', 1800 + Math.random() * 400, c.currentTime, 0.14, 0.12); }
// El propulsor grabado: arranca con el principio del soplido y, mientras se mantiene la tecla, repite el tramo
// del medio sin corte; al soltar se apaga rápido. Devuelve false si la grabación todavía no está lista.
let thrust: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
export function setThrustSound(on: boolean) {
  const c = running();
  if (!on) {
    if (thrust && c) { const t = c.currentTime; thrust.gain.gain.cancelScheduledValues(t); thrust.gain.gain.setTargetAtTime(0, t, 0.04); thrust.source.stop(t + 0.3); }
    thrust = null;
    return true;
  }
  if (thrust) return true;
  const buffer = samples.get(propulsorUrl);
  if (!c || !(buffer instanceof AudioBuffer)) { loadSample(propulsorUrl); return false; }
  const source = c.createBufferSource(), gain = c.createGain();
  source.buffer = buffer; source.loop = true; source.loopStart = 0.18; source.loopEnd = Math.min(buffer.duration, 0.74);
  gain.gain.setValueAtTime(0.0001, c.currentTime); gain.gain.setTargetAtTime(0.95, c.currentTime, 0.015);
  source.connect(gain).connect(out(c)); source.start();
  thrust = { source, gain };
  return true;
}
// Al morir, además del golpe, el sonido de la caída de SkynetBall.
export function playAstronautSplat() { playSplat(1); }
// Pasaste una bandera: dos notas que suben, como una campanita.
export function playCheckpoint() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  [784, 1175, 1568].forEach((f, i) => tone(c, 'triangle', f, f, t + i * 0.09, 0.3, 0.28));
}
// El monstruo te vio: un rugido grave que tiembla.
const GROWLS: [number, number][] = [[0.45, 1.85], [3.2, 4.55], [5.25, 6.05], [6.6, 7.45], [8.25, 9.45], [10.35, 11.7], [12.35, 13.55], [14, 16.1], [16.45, 17.15]];
let growl = 0;
export function playMonsterRoar() {
  const c = running(); if (!c) return;
  // La grabación trae varios gruñidos con silencios en el medio: cada rugido usa otro (en orden).
  const buffer = samples.get(monstruoUrl);
  if (buffer instanceof AudioBuffer) {
    const [from, to] = GROWLS[growl]; growl = (growl + 1) % GROWLS.length;
    const source = c.createBufferSource(), gain = c.createGain();
    source.buffer = buffer; gain.gain.value = 1.1; source.connect(gain).connect(out(c));
    source.start(c.currentTime, Math.max(0, from - 0.05), to - from + 0.15);
    return;
  }
  loadSample(monstruoUrl);
  const t = c.currentTime;
  tone(c, 'sawtooth', 140, 70, t, 0.7, 0.22);
  tone(c, 'square', 95, 55, t + 0.04, 0.65, 0.12);
  burst(c, 'lowpass', 600, t, 0.6, 0.35);
}
// El cometa entra: un silbido de fuego que baja.
export function playComet() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  burst(c, 'bandpass', 2400, t, 1.1, 0.3);
  tone(c, 'sine', 1800, 300, t, 1.1, 0.12);
}
// El gusano sale: un retumbo de tierra.
let lastWorm = -1;
export function playWorm() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  if (t - lastWorm < 0.4) return; // si salen varios juntos, suena uno
  lastWorm = t;
  if (playSample(gusanoUrl, 0.85)) return; // la grabación del gusano
  burst(c, 'lowpass', 220, t, 0.5, 0.7);
  tone(c, 'sawtooth', 70, 45, t, 0.45, 0.15);
}

// ---------- Kombat Football ----------
export function preloadKombatSounds() { for (const url of [golUrl, hinchadaUrl, patadaUrl, explosionUrl, laserUrl, trepaFuegoUrl, bombaUrl, ...TRUENOS]) loadSample(url); }
// Una piña / patada al cuerpo: golpe grave y seco con un chasquido.
export function playKfHit(volume = 1) {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sine', 180, 45, t, 0.18, 0.9 * volume);
  burst(c, 'lowpass', 900, t, 0.12, 0.7 * volume);
  burst(c, 'highpass', 3000, t, 0.03, 0.35 * volume);
}
// Bloqueo: un escudo de energía que suena metálico.
export function playKfBlock() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'triangle', 900, 700, t, 0.25, 0.22); tone(c, 'sine', 1800, 1500, t, 0.18, 0.12);
  burst(c, 'bandpass', 2500, t, 0.08, 0.3);
}
// La pelota pega en el palo.
export function playKfPost() { const c = running(); if (!c) return; const t = c.currentTime; tone(c, 'triangle', 620, 600, t, 0.5, 0.3); tone(c, 'sine', 1240, 1200, t, 0.35, 0.12); }
// Un rebote de la pelota contra el piso (más fuerte cuanto más rápido venía).
export function playKfBounce(power: number) { const c = running(); if (!c || power < 0.08) return; tone(c, 'sine', 120, 70, c.currentTime, 0.1, 0.4 * power); }
// Las habilidades de cada personaje.
export function playKfPower(char: 'toxic' | 'bull' | 'frost' | 'volt' | 'void', defense: boolean) {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  switch (char) {
    case 'toxic': burst(c, 'bandpass', 600, t, 0.5, 0.6); tone(c, 'sawtooth', 120, 60, t, 0.4, 0.15); for (let k = 0; k < 5; k++) tone(c, 'sine', 300 + k * 90, 500 + k * 120, t + k * 0.06, 0.08, 0.12); break; // burbujeo
    case 'bull': playSample(trepaFuegoUrl, defense ? 0.9 : 0.7); burst(c, 'lowpass', 400, t, 0.6, 0.6); tone(c, 'sawtooth', 90, 50, t, 0.5, 0.25); break;
    case 'frost': for (let k = 0; k < 6; k++) tone(c, 'sine', 2400 + k * 300, 1800 + k * 200, t + k * 0.04, 0.2, 0.1); burst(c, 'highpass', 4000, t, defense ? 0.7 : 0.5, 0.4); break;
    case 'volt': if (!playSample(laserUrl, 0.5)) tone(c, 'square', 200, 1600, t, 0.3, 0.15); burst(c, 'highpass', 5000, t, 0.4, 0.4); tone(c, 'sawtooth', 60, 60, t, 0.5, 0.1); break;
    case 'void': tone(c, 'sine', 900, 80, t, 0.7, 0.4); tone(c, 'triangle', 300, 1200, t + 0.1, 0.5, 0.15); burst(c, 'bandpass', 300, t, 0.6, 0.3); break;
  }
}
// FATAL GOAL: un golpe enorme, un estruendo que sube y una campanada grave.
export function playKfFatal() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  tone(c, 'sine', 70, 30, t, 1.4, 1.1);
  tone(c, 'sawtooth', 55, 220, t + 0.1, 1.2, 0.18);
  burst(c, 'lowpass', 600, t, 1.2, 0.8);
  [110, 165, 220].forEach((f, i) => tone(c, 'triangle', f, f, t + 0.05 + i * 0.02, 1.6, 0.18));
  playSample(explosionUrl, 0.7, 0.05);
}
// Agarró un potenciador o cambió la pelota: un arpegio corto que sube.
export function playKfPickup() { const c = running(); if (!c) return; const t = c.currentTime; [660, 880, 1320].forEach((f, i) => tone(c, 'triangle', f, f, t + i * 0.06, 0.18, 0.22)); }
