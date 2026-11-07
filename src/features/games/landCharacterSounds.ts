import type { LandGame,Role } from './land';
import type { CivId } from './landCivs';
import type { Cam } from './landArt';
import { CHARACTER_CLIPS,characterClips } from './landCharacterClips';
import { footContact } from './landMotion';
import { LandSoundOutput,type CharacterSoundOutput } from './landSoundOutput';
export class LandCharacterSounds {
  private active=false;
  private serial=0;
  private lastContact=new Map<number,number>();
  private lastCall=-Infinity;
  private lastEffect=-Infinity;
  private variant=new Map<string,number>();
  constructor(private output:CharacterSoundOutput=new LandSoundOutput()){}
  start(civ:CivId){this.output.unlock();void this.output.preload(CHARACTER_CLIPS.filter(c=>c.civ===civ));}
  setActive(on:boolean){this.active=on;this.serial++;this.lastContact.clear();if(on)this.output.unlock();else this.output.stop();}
  tick(g:LandGame,cam:Cam,selected:ReadonlySet<number>){
    if(!this.active)return;
    const visible=g.units.filter(u=>!u.dead&&u.x>=cam.x-100&&u.x<=cam.x+cam.w/cam.z+100&&u.y>=cam.y&&u.y<=cam.y+(cam.h-214)/cam.z+100);
    visible.sort((a,b)=>Number(selected.has(b.id))-Number(selected.has(a.id))||Math.abs(a.x-cam.x-cam.w/cam.z/2)-Math.abs(b.x-cam.x-cam.w/cam.z/2));
    const live=new Set(visible.map(u=>u.id));for(const id of this.lastContact.keys())if(!live.has(id))this.lastContact.delete(id);
    for(const u of visible){
      const contact=footContact(u.walk),old=this.lastContact.get(u.id);this.lastContact.set(u.id,contact);
      if(!u.moving||old===undefined||old===contact)continue;
      const civ=g.sides[u.owner].civ,clips=characterClips(civ,u.role,'foot');if(!clips.length)continue;
      const index=this.next(`${civ}:${u.role}:foot`),clip=clips[index%clips.length],cue=clip.steps[Math.floor(index/clips.length)%clip.steps.length];
      void this.output.preload(clips);
      const px=(u.x-cam.x)*cam.z,pan=(px/cam.w-.5)*1.3;
      this.output.play(clip,cue,.24,pan,'foot');
    }
  }
  react(g:LandGame,ids:number[]){
    if(!this.active||g.t-this.lastCall<1)return;
    const unit=g.units.find(u=>ids.includes(u.id)&&u.owner===0&&!u.dead);if(unit)this.call(g.sides[0].civ,unit.role,g.t);
  }
  call(civ:CivId,role:Role,time:number){
    if(!this.active||time-this.lastCall<1)return;
    const clips=characterClips(civ,role,'call');if(!clips.length)return;
    const index=this.next(`${civ}:${role}:call`),clip=clips[index%clips.length],cue=clip.phrases[Math.floor(index/clips.length)%clip.phrases.length],serial=this.serial;
    this.lastCall=time+Math.max(0,cue.duration-.75);this.output.unlock();
    void this.output.preload([clip]).then(()=>{if(this.active&&this.serial===serial)this.output.play(clip,cue,.45,0,'call');});
  }
  attack(g:LandGame,owner:number,role:Role){
    if(!this.active||g.t-this.lastEffect<.6)return false;
    const civ=g.sides[owner].civ,clips=characterClips(civ,civ==='zergano'&&role==='special'?'acid':role,'effect');if(!clips.length)return false;
    const clip=clips[this.next(`${civ}:${role}:effect`)%clips.length],cue=clip.phrases[0];void this.output.preload(clips);
    const played=this.output.play(clip,{...cue,duration:Math.min(.65,cue.duration)},.4,0,'effect');if(played)this.lastEffect=g.t;return played;
  }
  private next(key:string){const value=this.variant.get(key)??0;this.variant.set(key,value+1);return value;}
  dispose(){this.setActive(false);this.output.dispose();}
}
