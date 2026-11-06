import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./sounds',()=>({playKnock:vi.fn()}));
class FakeAudio {
  static instances: FakeAudio[]=[];
  src:string;paused=true;currentTime=0;preload='';volume=1;ended:()=>void=()=>{};
  constructor(src:string){this.src=src;FakeAudio.instances.push(this);}
  addEventListener(_:string,fn:()=>void){this.ended=fn;}
  getAttribute(){return this.src;}
  async play(){this.paused=false;}
  pause(){this.paused=true;}
}
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();FakeAudio.instances=[];});
describe('Música de Land',()=>{
  it('reproduce 1,1,2,2 en bucle sin reiniciar al cambiar de pantalla de menú',async()=>{
    vi.stubGlobal('Audio',FakeAudio);const {setLandMenuMusic}=await import('./landAudio');setLandMenuMusic(true);
    const p=FakeAudio.instances[0],first=p.src,played=[p.src];p.currentTime=15;setLandMenuMusic(true);expect(p.currentTime).toBe(15);
    for(let i=0;i<7;i++){p.ended();played.push(p.src);}
    const second=played[2];expect(second).not.toBe(first);expect(played).toEqual([first,first,second,second,first,first,second,second]);
    setLandMenuMusic(false);expect(p.paused).toBe(true);expect(p.currentTime).toBe(0);expect(p.src).toBe(first);
    p.ended();expect(p.paused).toBe(true);
  });
});
