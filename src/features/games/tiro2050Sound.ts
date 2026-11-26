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
import musica1Url from './assets/sonidos/tiro2050-musica-1.mp3';
import musica2Url from './assets/sonidos/tiro2050-musica-2.mp3';
import musica3Url from './assets/sonidos/tiro2050-musica-3.mp3';
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
export function preloadTiroSounds() { for (const [url] of [...Object.values(SHOTS), ...Object.values(RELOADS)]) load(url); }
export function playTiroShot(family: GunFamily, delay = 0) { play(SHOTS[family], delay); }
export function playTiroReload(family: GunFamily) { play(RELOADS[family]); }

// Música del juego (correcciones 16): Predator, Rambo y The Terminator, una tras otra y de nuevo desde la primera.
// Sigue sonando en los menús y en la pausa. Volumen por canción para que suenen parejas (Rambo viene más fuerte).

const SONGS: [string, number][] = [[musica1Url, .32], [musica2Url, .2], [musica3Url, .32]];
let music: HTMLAudioElement | null = null;
let song = 0;
function playSong() {
  if (!music) return;
  const [url, volume] = SONGS[song];
  music.src = url;
  music.volume = volume;
  void music.play().catch(() => undefined);
}
export function startTiroMusic() {
  if (typeof Audio === 'undefined') return;
  try {
    if (!music) {
      music = new Audio();
      music.addEventListener('ended', () => { song = (song + 1) % SONGS.length; playSong(); });
      playSong();
    } else if (music.paused) void music.play().catch(() => undefined);
  } catch { /* sin audio */ }
}
export function stopTiroMusic() {
  music?.pause();
  music = null;
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
