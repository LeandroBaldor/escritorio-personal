import {describe,it,expect} from 'vitest';
import {newLandGame,addUnit} from './land';
import {LandCharacterSounds} from './landCharacterSounds';
import type {CharacterClip,SoundCue} from './landCharacterClips';
import type {CharacterSoundOutput,SoundChannel} from './landSoundOutput';
import {walkPose,walkingPhase,motionKind} from './landMotion';
import {rigPoint} from './landRig';
class Output implements CharacterSoundOutput{
  played:{clip:CharacterClip;volume:number;pan:number;channel:SoundChannel}[]=[];
  unlock(){}async preload(){}play(clip:CharacterClip,_cue:SoundCue,volume:number,pan:number,channel:SoundChannel){this.played.push({clip,volume,pan,channel});return true;}stop(){}dispose(){}
}
const cam={x:0,y:0,w:1000,h:800,z:1};
function fixture(){const g=newLandGame('humano','elfos',1,'normal',12,'small');g.units=[];const out=new Output(),sounds=new LandCharacterSounds(out);sounds.start('humano');sounds.setActive(true);return {g,out,sounds};}
describe('Revisión 12: audio espacial y articulaciones',()=>{
  it('mantiene continuas las uniones de la malla y no mueve piernas al atacar quieto',()=>{
    for(const phase of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const y of [.23,.4,.58,.79,.95])for(const x of [.21,.29,.5,.7,.79]){const a=rigPoint(x-.0001,y,phase,true,.5),b=rigPoint(x+.0001,y,phase,true,.5);expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(.002);expect(Number.isFinite(a.x+a.y)).toBe(true);}
    const feet=rigPoint(.29,.98,0,false,1);expect(feet.x).toBeCloseTo(.29);expect(feet.y).toBeCloseTo(.98);
  });
  it('reproduce voces de la civilización rival al entrar en cámara, también si sus unidades están quietas',async()=>{
    const {g,out,sounds}=fixture(),enemy=addUnit(g,1,'worker',3000,300);sounds.tick(g,cam,new Set());await Promise.resolve();expect(out.played).toHaveLength(0);
    const enemyCam={...cam,x:2500};sounds.tick(g,enemyCam,new Set());await Promise.resolve();expect(out.played[0].clip.civ).toBe('elfos');expect(out.played[0].channel).toBe('call');
    g.t=1;sounds.tick(g,enemyCam,new Set());await Promise.resolve();expect(out.played).toHaveLength(1);g.t=9;sounds.tick(g,enemyCam,new Set());await Promise.resolve();expect(out.played).toHaveLength(2);expect(enemy.moving).not.toBe(true);
  });
  it('descarta voces rivales que terminan de cargar después de abandonar esa zona',async()=>{
    const {g,out,sounds}=fixture();addUnit(g,1,'worker',400,300);sounds.tick(g,cam,new Set());sounds.tick(g,{...cam,x:3000},new Set());await Promise.resolve();expect(out.played).toHaveLength(0);
  });
  it('reduce los pasos y conserva el ritmo de apoyo incluso en unidades enemigas',async()=>{
    const {g,out,sounds}=fixture();g.sides[1].civ='humano';const u=addUnit(g,1,'worker',400,300);u.moving=true;u.walk=16;sounds.tick(g,cam,new Set());await Promise.resolve();u.walk=17;sounds.tick(g,cam,new Set());
    const feet=out.played.filter(p=>p.channel==='foot');expect(feet).toHaveLength(1);expect(feet[0].volume).toBeLessThan(.12);expect(feet[0].pan).toBeLessThan(0);
  });
  it('alterna piernas y brazos, dobla la rodilla de retorno y cierra el ciclo sin saltos',()=>{
    const a=walkPose(.6),b=walkPose(.6+Math.PI),cycle=walkPose(.6+Math.PI*2);
    expect(a.left.hip).toBeCloseTo(b.right.hip);expect(a.left.arm*a.left.hip).toBeLessThan(0);expect(cycle.left.knee).toBeCloseTo(a.left.knee);expect(walkPose(walkingPhase(17)).left.lift).toBeCloseTo(0);
    expect(walkPose(Math.PI).left.knee).toBeGreaterThan(.3);expect(walkPose(0,0).left.knee).toBe(0);
    expect(motionKind('humano',4)).toBe('treads');expect(motionKind('humano',5)).toBe('biped');expect(motionKind('elfos',5)).toBe('fly');expect(motionKind('zergano',2)).toBe('crawl');
  });
});
