// Tiro al Blanco 2050: disparos y recargas con las grabaciones del usuario (correcciones 12).
// WebAudio propio (no usa sounds.ts) para poder agendar cada tiro al ritmo de la ráfaga.
import ametralladoraUrl from './assets/sonidos/tiro2050-disparo-ametralladora.mp3';
import escopetaUrl from './assets/sonidos/tiro2050-disparo-escopeta.mp3';
import pistolaUrl from './assets/sonidos/tiro2050-disparo-pistola.mp3';
import pistolaAlienUrl from './assets/sonidos/tiro2050-disparo-pistola-alien.mp3';
import rifleUrl from './assets/sonidos/tiro2050-disparo-rifle.mp3';
import recargaAmetralladoraUrl from './assets/sonidos/tiro2050-recarga-ametralladora.mp3';
import recargaEscopetaUrl from './assets/sonidos/tiro2050-recarga-escopeta.mp3';
import recargaPistolaUrl from './assets/sonidos/tiro2050-recarga-pistola.mp3';
import recargaRifleUrl from './assets/sonidos/tiro2050-recarga-rifle.mp3';
import cascillo1Url from './assets/sonidos/tiro2050-cascillo-1.mp3';
import cascillo2Url from './assets/sonidos/tiro2050-cascillo-2.mp3';
import cascillo3Url from './assets/sonidos/tiro2050-cascillo-3.mp3';
import musica1Url from './assets/sonidos/tiro2050-musica-1.mp3';
import musica2Url from './assets/sonidos/tiro2050-musica-2.mp3';
import musica3Url from './assets/sonidos/tiro2050-musica-3.mp3';
import cuentaRegresivaUrl from './assets/sonidos/tiro2050-cuenta-regresiva.mp3';
import alarmaUrl from './assets/sonidos/tiro2050-alarma.mp3';

export type GunFamily = 'ametralladora' | 'escopeta' | 'rifle' | 'pistola' | 'pistolaAlien';

// Volumen de cada archivo para que suenen parejos (las grabaciones vienen muy distintas).
const SHOTS: Record<GunFamily, [string, number]> = {
  ametralladora: [ametralladoraUrl, 1.2], // un solo tiro sacado de arma_ametralladora.mp3 (la grabación es una ráfaga entera)
  escopeta: [escopetaUrl, .45],
  rifle: [rifleUrl, .9],
  pistola: [pistolaUrl, 1],
  pistolaAlien: [pistolaAlienUrl, 1.5],
};
const RELOADS: Record<GunFamily, [string, number]> = {
  ametralladora: [recargaAmetralladoraUrl, .7],
  escopeta: [recargaEscopetaUrl, 1],
  rifle: [recargaRifleUrl, 1.6],
  pistola: [recargaPistolaUrl, 1.3],
  pistolaAlien: [recargaPistolaUrl, 1.3],
};

// Qué familia es cada arma: principal 0 ametralladora, 1 rifle de asalto, 2 escopeta, 3 rifle de precisión;
// de reserva todas son pistolas (el revólver también) y la Pistola Alien (2) tiene su propio disparo.
export const gunFamily = (slot: 0 | 1, index: number): GunFamily =>
  slot === 0 ? (['ametralladora', 'rifle', 'escopeta', 'rifle'] as const)[index] ?? 'rifle' : index === 2 ? 'pistolaAlien' : 'pistola';

let ac: AudioContext | null = null;
let bus: AudioNode | null = null;
const buffers = new Map<string, AudioBuffer | 'loading'>();
function audio() {
  if (typeof window === 'undefined') return null;
  try {
    if (!ac) {
      ac = new AudioContext();
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 8;
      const gain = ac.createGain(); gain.gain.value = .9;
      gain.connect(comp).connect(ac.destination); bus = gain;
    }
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch { return null; }
}
function load(url: string) {
  const c = audio();
  if (!c || buffers.has(url)) return;
  buffers.set(url, 'loading');
  fetch(url).then(r => r.arrayBuffer()).then(data => c.decodeAudioData(data)).then(b => buffers.set(url, b)).catch(() => buffers.delete(url));
}
function play([url, volume]: [string, number], delay = 0) {
  const c = audio(), b = buffers.get(url);
  if (!c || !bus || !(b instanceof AudioBuffer)) { load(url); return; }
  const src = c.createBufferSource(), g = c.createGain();
  src.buffer = b; g.gain.value = volume;
  src.connect(g).connect(bus); src.start(c.currentTime + Math.max(0, delay));
}

// Cargar todo al empezar la ronda, así el primer tiro ya suena.
export function preloadTiroSounds() { for (const [url] of [...Object.values(SHOTS), ...Object.values(RELOADS), ...CASINGS]) load(url); }

// Cascillos: tres golpes distintos recortados de casquillos.mp3 del usuario (en 4,5 s, 8,3 s y 11,2 s del archivo).
// Suenan cuando el cascillo cae al piso, fuera de la pantalla (~0,55 s después del tiro), uno al azar y más bajos
// que los disparos. Con las automáticas no suenan todos: como mucho uno cada 160 ms, para que no sea un ruido continuo.
const CASINGS: [string, number][] = [[cascillo1Url, .4], [cascillo2Url, .4], [cascillo3Url, .4]];
export const CASING_SOUND_DELAY = .55;
let lastCasing = -Infinity;
export function playTiroCasing() {
  const c = audio();
  if (!c) return;
  const at = c.currentTime + CASING_SOUND_DELAY;
  if (at - lastCasing < .16) return;
  lastCasing = at;
  play(CASINGS[Math.floor(Math.random() * CASINGS.length)], CASING_SOUND_DELAY);
}
export function playTiroShot(family: GunFamily, delay = 0) { play(SHOTS[family], delay); }
// Correcciones 20: el sonido de recarga de la pistola arranca un poco después del último tiro, así el estampido no lo tapa
// y se escucha completo; la recarga dura ese retraso más el sonido.
export const RELOAD_DELAY: Record<GunFamily, number> = { ametralladora: 0, escopeta: 0, rifle: 0, pistola: 300, pistolaAlien: 300 };
export function playTiroReload(family: GunFamily) { play(RELOADS[family], RELOAD_DELAY[family] / 1000); }
// Lo que dura cada sonido de recarga (ms): la recarga del arma y su movimiento duran lo mismo.
export const RELOAD_DURATION: Record<GunFamily, number> = { ametralladora: 1510, escopeta: 860, rifle: 1440, pistola: 300 + 840, pistolaAlien: 300 + 840 };

// Música del juego (correcciones 16): Predator, Rambo y The Terminator, una tras otra y de nuevo desde la primera.
// Sigue sonando en los menús y en la pausa. Volumen por canción para que suenen parejas (Rambo viene más fuerte).

// Correcciones 18: el doble de fuerte que en las 17 (pasa de 1, así que va por una ganancia de WebAudio con un limitador
// para que no sature). Rambo es la versión nueva (Rambo_2), que viene pareja con las otras.
// Predator arranca en el segundo 14,5 del original (los primeros 14 s eran casi mudos) para que se escuche apenas se abre el menú.
const SONGS: [string, number][] = [[musica1Url, 1.28], [musica2Url, 1.2], [musica3Url, 1.28]];
const MUTE_KEY = 'escritorio-personal-juegos:tiro2050-musica-silenciada';
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();
export const isTiroMusicMuted = () => muted;
export function setTiroMusicMuted(next: boolean) {
  muted = next;
  if (music) music.muted = next;
  if (musicGain) musicGain.gain.value = next ? 0 : SONGS[song][1];
  try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* sin almacenamiento */ }
}
let music: HTMLAudioElement | null = null;
let musicGain: GainNode | null = null;
let song = 0;
function playSong() {
  if (!music) return;
  const [url, volume] = SONGS[song];
  music.src = url;
  if (musicGain) { music.volume = 1; musicGain.gain.value = muted ? 0 : volume; } else music.volume = Math.min(1, volume);
  void music.play().catch(() => undefined);
}
export function startTiroMusic() {
  if (typeof Audio === 'undefined') return;
  try {
    if (!music) {
      music = new Audio();
      music.muted = muted;
      const c = audio();
      if (c) {
        const limiter = c.createDynamicsCompressor();
        limiter.threshold.value = -3; limiter.knee.value = 3; limiter.ratio.value = 20; limiter.attack.value = .003; limiter.release.value = .2;
        musicGain = c.createGain();
        c.createMediaElementSource(music).connect(musicGain).connect(limiter).connect(c.destination);
      }
      music.addEventListener('ended', () => { song = (song + 1) % SONGS.length; playSong(); });
      playSong();
    } else {
      audio();
      if (music.paused) void music.play().catch(() => undefined);
    }
  } catch { /* sin audio */ }
}
export function stopTiroMusic() {
  music?.pause();
  music = null;
  musicGain?.disconnect();
  musicGain = null;
  song = 0;
}

// Un solo pitido de alarma.mp3 al empezar cada ronda de 10 tiros de Target.
let alarm: HTMLAudioElement | null = null;
export function preloadTiroAlarm() {
  if (typeof Audio === 'undefined' || alarm) return;
  try { alarm = new Audio(alarmaUrl); alarm.preload = 'auto'; } catch { /* sin audio */ }
}
export function playTiroAlarm() {
  preloadTiroAlarm();
  if (!alarm) return;
  alarm.currentTime = 0;
  alarm.volume = .8;
  void alarm.play().catch(() => undefined);
}

// Cuenta regresiva al final de cada prueba (y de cada ronda de Target): 3 pitidos graves y el 4.º justo cuando termina.
// Los pitidos están en 0, 1, 2 y 3 s del archivo, así que arranca 3 s antes del final.
export const COUNTDOWN_LEAD_MS = 3000;
let countdown: HTMLAudioElement | null = null;
export function preloadTiroCountdown() {
  if (typeof Audio === 'undefined' || countdown) return;
  try { countdown = new Audio(cuentaRegresivaUrl); countdown.preload = 'auto'; } catch { /* sin audio */ }
}
export function playTiroCountdown(offsetMs = 0) {
  preloadTiroCountdown();
  if (!countdown) return;
  countdown.currentTime = Math.max(0, offsetMs / 1000);
  countdown.volume = .9;
  void countdown.play().catch(() => undefined);
}
export function pauseTiroCountdown() { countdown?.pause(); }
export function resumeTiroCountdown() { if (countdown && countdown.currentTime > 0 && !countdown.ended) void countdown.play().catch(() => undefined); }
export function stopTiroCountdown() { if (countdown) { countdown.pause(); countdown.currentTime = 0; } }
