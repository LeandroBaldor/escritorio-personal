// Efectos de sonido de los juegos, generados con Web Audio (sin archivos de audio).
// El contexto se crea recién con un clic o una tecla: los navegadores no dejan sonar nada antes.
import { AMBIENT_CHANNELS, type AmbientChannel } from './trepaSound';

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
    if (ctx.state === 'suspended') void ctx.resume();
    master ??= limiter(ctx);
    ambient ??= buildAmbient(ctx);
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
const running = () => ctx && ctx.state === 'running' ? ctx : null;

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
function buildAmbient(c: AudioContext) {
  const channel = (max: number, make: (out: GainNode) => void) => {
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(out(c));
    make(gain);
    return { gain, max };
  };
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
  if (!ctx || !ambient) return;
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
function scream(c: AudioContext, start: number) {
  const voice = osc(c, 'sawtooth', 620), gain = c.createGain();
  voice.frequency.setValueAtTime(620, start);
  voice.frequency.exponentialRampToValueAtTime(700, start + 0.12);
  voice.frequency.exponentialRampToValueAtTime(300, start + 0.75);
  wobble(c, voice.frequency, 7, 18);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.9, start + 0.04);
  gain.gain.setValueAtTime(0.9, start + 0.5);
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
export function playGameOver() {
  const c = running(); if (!c) return;
  const t = c.currentTime;
  burst(c, 'lowpass', 300, t, 0.25, 0.8); // el golpe contra la calle
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
