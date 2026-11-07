import music1 from './assets/land/menu-musica.mp3';
import music2 from './assets/land/menu-musica-2.mp3';
import buttonSound from './assets/land/menu-boton.mp3';

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
const buttons:HTMLAudioElement[]=[];let buttonIndex=0;
function buttonPlayers(){if(!buttons.length&&typeof Audio!=='undefined')for(let i=0;i<3;i++){const p=new Audio(buttonSound);p.preload='auto';p.volume=.5;buttons.push(p);}return buttons;}
export function preloadLandSounds() { player();buttonPlayers(); }
export function setLandMenuMusic(on: boolean) {
  enabled = on; const p = player(); if (!p) return;
  if (!on) { p.pause(); index = 0; p.currentTime = 0; if (p.getAttribute('src') !== PLAYLIST[0]) p.src = PLAYLIST[0]; return; }
  if (p.paused) void p.play().catch(() => { /* autoplay requiere un gesto */ });
}
export function playLandButton() {const pool=buttonPlayers();if(!pool.length)return;const p=pool[buttonIndex++%pool.length];p.currentTime=0;void p.play().catch(()=>{});}
