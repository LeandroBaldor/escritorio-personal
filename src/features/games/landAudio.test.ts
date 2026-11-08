import { afterEach, describe, expect, it, vi } from 'vitest';
class FakeAudio {
  static instances: FakeAudio[]=[];
  src:string;paused=true;currentTime=0;preload='';volume=1;loop=false;muted=false;ended:()=>void=()=>{};
  constructor(src:string){this.src=src;FakeAudio.instances.push(this);}
  addEventListener(_:string,fn:()=>void){this.ended=fn;}
  getAttribute(){return this.src;}
  async play(){this.paused=false;}
  pause(){this.paused=true;}
}
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();FakeAudio.instances=[];});
describe('Música de Land',()=>{
  it('repite la música de partida y permite silenciar sin perder la posición ni apagar efectos',async()=>{
    vi.stubGlobal('Audio',FakeAudio);const {setLandGameMusic,resetLandGameMusic,playLandButton}=await import('./landAudio');setLandGameMusic(true);const p=FakeAudio.instances[0];expect(p.src).toContain('music-game.mp3');expect(p.loop).toBe(true);p.ended();expect(p.paused).toBe(false);expect(p.currentTime).toBe(0);p.currentTime=18;setLandGameMusic(true,true);expect(p.paused).toBe(true);expect(p.muted).toBe(true);expect(p.currentTime).toBe(18);playLandButton();expect(FakeAudio.instances.slice(1).some(a=>!a.paused)).toBe(true);setLandGameMusic(true,false);expect(p.paused).toBe(false);expect(p.currentTime).toBe(18);setLandGameMusic(false);expect(p.currentTime).toBe(18);resetLandGameMusic();expect(p.currentTime).toBe(0);p.ended();expect(p.paused).toBe(true);
  });
  it('baja la música mientras hay voces y recupera su volumen sin quitar mute',async()=>{
    vi.stubGlobal('Audio',FakeAudio);const {setLandGameMusic,duckLandGameMusic}=await import('./landAudio');setLandGameMusic(true);const p=FakeAudio.instances[0],normal=p.volume;duckLandGameMusic(true);expect(p.volume).toBeLessThan(normal);setLandGameMusic(true,true);duckLandGameMusic(false);expect(p.volume).toBe(normal);expect(p.paused).toBe(true);expect(p.muted).toBe(true);
  });
  it('reproduce el MP3 nuevo en cada botón y admite clics sucesivos sin reiniciar la música',async()=>{
    vi.stubGlobal('Audio',FakeAudio);const {preloadLandSounds,setLandMenuMusic,playLandButton}=await import('./landAudio');preloadLandSounds();setLandMenuMusic(true);const music=FakeAudio.instances[0];music.currentTime=12;
    playLandButton();playLandButton();playLandButton();playLandButton();const buttons=FakeAudio.instances.slice(1);expect(buttons).toHaveLength(3);expect(buttons.every(p=>p.src.includes('menu-boton.mp3')&&!p.paused)).toBe(true);expect(music.currentTime).toBe(12);
  });
  it('reproduce únicamente la nueva música en bucle sin reiniciar al cambiar de pantalla de menú',async()=>{
    vi.stubGlobal('Audio',FakeAudio);const {setLandMenuMusic}=await import('./landAudio');setLandMenuMusic(true);
    const p=FakeAudio.instances[0],first=p.src,played=[p.src];expect(p.volume).toBeCloseTo(.6);p.currentTime=15;setLandMenuMusic(true);expect(p.currentTime).toBe(15);
    for(let i=0;i<7;i++){p.ended();played.push(p.src);}
    expect(first).toContain('menu-musica-3.mp3');expect(played).toEqual(Array(8).fill(first));expect(p.currentTime).toBe(0);
    setLandMenuMusic(false);expect(p.paused).toBe(true);expect(p.currentTime).toBe(0);expect(p.src).toBe(first);
    p.ended();expect(p.paused).toBe(true);
  });
});
