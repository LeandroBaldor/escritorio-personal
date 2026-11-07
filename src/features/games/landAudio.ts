import menuMusic from './assets/land/menu-musica-3.mp3';
import buttonSound from './assets/land/menu-boton.mp3';

let audio: HTMLAudioElement | null = null, enabled = false;
function player() {
  if (!audio && typeof Audio !== 'undefined') {
    audio = new Audio(menuMusic); audio.preload = 'auto'; audio.volume = .6;
    audio.addEventListener('ended', () => {
      if (!enabled || !audio) return;
      audio.currentTime = 0;
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
  if (!on) { p.pause(); p.currentTime = 0; return; }
  if (p.paused) void p.play().catch(() => { /* autoplay requiere un gesto */ });
}
export function playLandButton() {const pool=buttonPlayers();if(!pool.length)return;const p=pool[buttonIndex++%pool.length];p.currentTime=0;void p.play().catch(()=>{});}
