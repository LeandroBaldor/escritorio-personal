import menuMusic from './assets/land/menu-musica-3.mp3';
import buttonSound from './assets/land/menu-boton.mp3';
import gameMusic from './assets/land/music-game.mp3';

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
let matchAudio:HTMLAudioElement|null=null,matchEnabled=false,matchMuted=false;
function matchPlayer(){if(!matchAudio&&typeof Audio!=='undefined'){matchAudio=new Audio(gameMusic);matchAudio.preload='auto';matchAudio.loop=true;matchAudio.volume=.22;matchAudio.addEventListener('ended',()=>{if(!matchAudio||!matchEnabled||matchMuted)return;matchAudio.currentTime=0;void matchAudio.play().catch(()=>{});});}return matchAudio;}
export function setLandGameMusic(on:boolean,muted=false){matchEnabled=on;matchMuted=muted;if(!matchAudio&&!on)return;const p=matchPlayer();if(!p)return;p.muted=muted;if(on&&!muted){if(p.paused)void p.play().catch(()=>{});}else p.pause();}
export function resetLandGameMusic(){matchEnabled=false;if(matchAudio){matchAudio.pause();matchAudio.currentTime=0;}}
