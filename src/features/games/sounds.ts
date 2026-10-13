// Efectos de sonido de los juegos, generados con Web Audio (sin archivos de audio).
// El contexto se crea recién con un clic o una tecla: los navegadores no dejan sonar nada antes.
import { AMBIENT_CHANNELS, type AmbientChannel } from './trepaSound';
import { LAVA_CHANNELS, type LavaChannel } from './lavaSound';
import { STORM_CHANNELS, type StormChannel } from './sharkSound';
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
import electricidadUrl from './assets/sonidos/electricidad.mp3';
import fuegoUrl from './assets/sonidos/fuego.mp3';
import personaQuemaUrl from './assets/sonidos/persona-quema.mp3';

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
  return {
    // Fuego: un rugido grave con chisporroteo.
    fire: channel(0.85, out => {
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
    bird: channel(0.22, out => {
      const tweet = osc(c, 'sine', 3000), gate = c.createGain(), pattern = c.createGain();
      wobble(c, tweet.frequency, 9, 900, 'sawtooth');
      gate.gain.value = 0.5; wobble(c, gate.gain, 2.6, 0.5, 'square');
      pattern.gain.value = 0.5; wobble(c, pattern.gain, 0.55, 0.5, 'square');
      tweet.connect(gate).connect(pattern).connect(out); tweet.start();
    }),
    // Aviones: el rugido grave del motor al pasar.
    plane: channel(0.6, out => {
      const jet = noiseSource(c), body = filter(c, 'lowpass', 650);
      jet.connect(body).connect(out); jet.start();
      const engine = osc(c, 'sawtooth', 74), low = filter(c, 'lowpass', 380), level = c.createGain();
      level.gain.value = 0.5; wobble(c, level.gain, 3, 0.15);
      engine.connect(low).connect(level).connect(out); engine.start();
    }),
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
    hover: channel(0.16, out => {
      const whir = osc(c, 'sawtooth', 330), low = filter(c, 'lowpass', 1500), level = c.createGain();
      wobble(c, whir.frequency, 1.5, 15);
      level.gain.value = 0.6; wobble(c, level.gain, 38, 0.4);
      whir.connect(low).connect(level).connect(out); whir.start();
    }),
    // Pistones y bloques tecnológicos: aire comprimido y un zumbido hidráulico.
    hydraulic: channel(0.35, out => {
      const hiss = noiseSource(c), hi = filter(c, 'highpass', 2200), level = c.createGain();
      level.gain.value = 0.5; wobble(c, level.gain, 1.1, 0.4);
      hiss.connect(hi).connect(level).connect(out); hiss.start();
      const pump = osc(c, 'sine', 90); pump.connect(out); pump.start();
    }),
    // Ovnis y satélites: el clásico sonido ondulante de ciencia ficción.
    ufo: channel(0.14, out => {
      for (const [f, rate, depth] of [[520, 7, 120], [780, 5, 60]]) { const tone = osc(c, 'sine', f); wobble(c, tone.frequency, rate, depth); tone.connect(out); tone.start(); }
    }),
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
export function playJump() {
  const c = running(); if (!c) return;
  tone(c, 'square', 330, 760, c.currentTime, 0.14, 0.35);
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
  scream(c, t + (reason === 'fall' ? 0 : 0.12));
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
function playSample(url: string, volume: number, delay = 0) {
  const c = running(), buffer = samples.get(url);
  if (!c || !(buffer instanceof AudioBuffer)) { loadSample(url); return false; }
  const source = c.createBufferSource(), gain = c.createGain();
  source.buffer = buffer; gain.gain.value = volume;
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
export function preloadLavaSounds() { for (const url of [lavaUrl, helicopteroUrl, electricidadUrl, fuegoUrl, personaQuemaUrl]) loadSample(url); }
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
    electric: channel(0.4, out => recorded(c, electricidadUrl, 1.6, out, out => {
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
    // Ascensor: el motor eléctrico que zumba y el cable que roza en las poleas.
    elevator: channel(0.32, out => {
      const motor = osc(c, 'sawtooth', 82), low = filter(c, 'lowpass', 280), level = c.createGain();
      level.gain.value = 0.7; wobble(c, level.gain, 5, 0.12);
      motor.connect(low).connect(level).connect(out); motor.start();
      const cable = noiseSource(c), band = filter(c, 'bandpass', 650, 3), rub = c.createGain();
      rub.gain.value = 0.35;
      cable.connect(band).connect(rub).connect(out); cable.start();
    }),
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
// El silbato del árbitro: un pitazo largo para sacar del medio, dos al terminar el primer tiempo y tres
// (el último bien largo) al final del partido.
export function playRefWhistle(kind: 'kickoff' | 'half' | 'end') {
  playWhistle(kind === 'kickoff' ? [[0, 0.6]] : kind === 'half' ? [[0, 0.35], [0.45, 0.9]] : [[0, 0.3], [0.4, 0.3], [0.8, 1.2]]);
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
