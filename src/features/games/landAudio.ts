import music1 from './assets/land/menu-musica.mp3';
import music2 from './assets/land/menu-musica-2.mp3';
import { playKnock } from './sounds';

const PLAYLIST = [music1, music1, music2, music2];
let audio: HTMLAudioElement | null = null, index = 0, enabled = false;
function player() {
  if (!audio && typeof Audio !== 'undefined') {
    audio = new Audio(PLAYLIST[0]); audio.preload = 'auto'; audio.volume = .5;
    audio.addEventListener('ended', () => {
      if (!enabled || !audio) return;
      index = (index + 1) % PLAYLIST.length; audio.src = PLAYLIST[index]; audio.currentTime = 0;
      void audio.play().catch(() => { /* el siguiente gesto vuelve a intentar */ });
    });
  }
  return audio;
}
export function preloadLandSounds() { player(); }
export function setLandMenuMusic(on: boolean) {
  enabled = on; const p = player(); if (!p) return;
  if (!on) { p.pause(); index = 0; p.currentTime = 0; if (p.getAttribute('src') !== PLAYLIST[0]) p.src = PLAYLIST[0]; return; }
  if (p.paused) void p.play().catch(() => { /* autoplay requiere un gesto */ });
}
// Golpe sintetizado, sin voces ni muestras del menú anterior.
export function playLandButton() { playKnock(); }
