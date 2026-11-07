import type { LandGame,LandEvent,Role } from './land';
import type { CivId } from './landCivs';
import type { Cam } from './landArt';
import { CHARACTER_CLIPS,characterClips } from './landCharacterClips';
import { footContact } from './landMotion';
import { LandSoundOutput,type CharacterSoundOutput } from './landSoundOutput';
import {COMBAT_CLIPS,weaponSound} from './landCombat';
export class LandCharacterSounds {
  private active=false;
  private serial=0;
  private lastContact=new Map<number,number>();
  private lastCall=-Infinity;
  private lastAmbient=-Infinity;
  private audible=new Set<number>();
  private combatTimes=new Map<string,number>();
  private variant=new Map<string,number>();
  constructor(private output:CharacterSoundOutput=new LandSoundOutput()){}
  start(civ:CivId){this.lastCall=-Infinity;this.lastAmbient=-Infinity;this.combatTimes.clear();this.output.unlock();void this.output.preload([...CHARACTER_CLIPS.filter(c=>c.civ===civ),...Object.values(COMBAT_CLIPS)]);}
  setActive(on:boolean){this.active=on;this.serial++;this.lastContact.clear();this.audible.clear();if(on)this.output.unlock();else this.output.stop();}
  tick(g:LandGame,cam:Cam,selected:ReadonlySet<number>){
    if(!this.active)return;
    const visible=g.units.filter(u=>!u.dead&&u.x>=cam.x-100&&u.x<=cam.x+cam.w/cam.z+100&&u.y>=cam.y&&u.y<=cam.y+(cam.h-214)/cam.z+100);
    visible.sort((a,b)=>Number(selected.has(b.id))-Number(selected.has(a.id))||Math.abs(a.x-cam.x-cam.w/cam.z/2)-Math.abs(b.x-cam.x-cam.w/cam.z/2));
    const live=new Set(visible.map(u=>u.id));this.audible=live;for(const id of this.lastContact.keys())if(!live.has(id))this.lastContact.delete(id);
    const enemy=visible.find(u=>u.owner>0);
    if(enemy&&g.t-this.lastAmbient>=8&&g.t-this.lastCall>=1){this.lastAmbient=g.t;this.call(g.sides[enemy.owner].civ,enemy.role,g.t,((enemy.x-cam.x)*cam.z/cam.w-.5)*1.3,()=>this.audible.has(enemy.id)&&!enemy.dead);}
    for(const u of visible){
      const contact=footContact(u.walk),old=this.lastContact.get(u.id);this.lastContact.set(u.id,contact);
      if(!u.moving||old===undefined||old===contact)continue;
      const civ=g.sides[u.owner].civ,clips=characterClips(civ,u.role,'foot');if(!clips.length)continue;
      const index=this.next(`${civ}:${u.role}:foot`),clip=clips[index%clips.length],cue=clip.steps[Math.floor(index/clips.length)%clip.steps.length];
      void this.output.preload(clips);
      const px=(u.x-cam.x)*cam.z,pan=(px/cam.w-.5)*1.3;
      this.output.play(clip,cue,.075,pan,'foot');
    }
  }
  react(g:LandGame,ids:number[]){
    if(!this.active||g.t-this.lastCall<1)return;
    const unit=g.units.find(u=>ids.includes(u.id)&&!u.dead);if(unit)this.call(g.sides[unit.owner].civ,unit.role,g.t,0,()=>unit.owner===0||this.audible.has(unit.id));
  }
  call(civ:CivId,role:Role,time:number,pan=0,stillAudible=()=>true){
    if(!this.active||time-this.lastCall<1)return;
    const clips=characterClips(civ,role,'call');if(!clips.length)return;
    const index=this.next(`${civ}:${role}:call`),clip=clips[index%clips.length],cue=clip.phrases[Math.floor(index/clips.length)%clip.phrases.length],serial=this.serial;
    this.lastCall=time+Math.max(0,cue.duration-.75);this.output.unlock();
    void this.output.preload([clip]).then(()=>{if(this.active&&this.serial===serial&&stillAudible())this.output.play(clip,cue,.45,pan,'call');});
  }
  combat(g:LandGame,event:LandEvent,pan=0){
    if(!this.active)return;
    const key=event.type==='shot'?weaponSound(g.sides[event.owner].civ,event.role):event.type==='impact'?'building':event.type==='die'&&!event.building?'death':null;
    if(!key)return;
    const gap=key==='death'?.22:key==='building'?.15:.09;
    if(g.t-(this.combatTimes.get(key)??-Infinity)<gap)return;
    this.combatTimes.set(key,g.t);const clip=COMBAT_CLIPS[key],serial=this.serial,time=g.t;
    // Descartar un sonido que terminó de descargarse tarde o después de pausar.
    void this.output.preload([clip]).then(()=>{if(this.active&&this.serial===serial&&g.t-time<.3)this.output.play(clip,clip.phrases[0],key==='death'?.55:.4,pan,key==='death'?'death':'effect');});
  }
  private next(key:string){const value=this.variant.get(key)??0;this.variant.set(key,value+1);return value;}
  dispose(){this.setActive(false);this.output.dispose();}
}
