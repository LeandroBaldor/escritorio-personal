import {describe,it,expect} from 'vitest';
import {newLandGame,addUnit} from './land';
import {colonyPopulation} from './landPopulation';
import {legCount,stepContact,stepVolume,FOOTSTEP_CLIP} from './landFootsteps';
import {LandCharacterSounds} from './landCharacterSounds';
import type {CharacterClip,SoundCue} from './landCharacterClips';
import type {CharacterSoundOutput,SoundChannel} from './landSoundOutput';
import {CIV_IDS} from './landCivs';
class Output implements CharacterSoundOutput{feet=0;unlock(){}async preload(){}play(_c:CharacterClip,_q:SoundCue,_v:number,_p:number,channel:SoundChannel){if(channel==='foot')this.feet++;return true;}stop(){}dispose(){}}
describe('Revisión 13: población y pasos orgánicos',()=>{
  it('cuenta habitantes vivos de la aldea por especie y diferencia plazas de población',()=>{
    const g=newLandGame('sauriano','orcos',1,'normal',3,'small');g.units=[];addUnit(g,0,'worker',300,300);addUnit(g,0,'worker',300,300);addUnit(g,0,'heavy',300,300);const dead=addUnit(g,0,'elite',300,300);dead.dead=.1;addUnit(g,1,'ranged',300,300);
    const p=colonyPopulation(g);expect(p.total).toBe(3);expect(p.used).toBe(5);expect(p.groups.find(x=>x.name==='Saurling')?.count).toBe(2);expect(p.groups.find(x=>x.name==='Triceratops de Asalto')?.count).toBe(1);expect(p.groups.find(x=>x.role==='elite')?.count).toBe(0);
  });
  it('todas las civilizaciones tienen una clasificación completa y excluye robots, orugas y voladores',()=>{
    for(const civ of CIV_IDS)for(const role of ['worker','melee','ranged','special','heavy','elite'] as const)expect([0,2,4,6]).toContain(legCount(civ,role));
    expect(legCount('mecanico','worker')).toBe(0);expect(legCount('humano','elite')).toBe(0);expect(legCount('enanos','heavy')).toBe(0);expect(legCount('elfos','elite')).toBe(0);expect(legCount('sauriano','heavy')).toBe(4);expect(legCount('abisal','worker')).toBe(6);
  });
  it('aumenta los apoyos con las piernas sin aumentar el volumen total y usa recortes del MP3 indicado',()=>{
    expect(stepContact(136,2)).toBe(4);expect(stepContact(136,4)).toBe(8);expect(stepContact(136,6)).toBe(12);expect(stepVolume(6)).toBeLessThan(stepVolume(2));expect(stepVolume(2)).toBeLessThan(.075);
    expect(FOOTSTEP_CLIP.source).toBe('SONIDOS/pasos.mp3');expect(FOOTSTEP_CLIP.steps.length).toBeGreaterThan(1);for(const cue of FOOTSTEP_CLIP.steps){expect(cue.duration).toBeLessThanOrEqual(.151);expect(cue.start+cue.duration).toBeLessThanOrEqual(FOOTSTEP_CLIP.duration+.002);}
  });
  it('los pasos nuevos se oyen también en criaturas de cuatro y seis patas pero nunca en robots',()=>{
    for(const [civ,role,expected] of [['sauriano','heavy',1],['abisal','worker',1],['mecanico','worker',0],['humano','elite',0]] as const){const g=newLandGame(civ,'orcos',1,'normal',3,'small');g.units=[];const u=addUnit(g,0,role,300,300),out=new Output(),sounds=new LandCharacterSounds(out);sounds.start(civ);sounds.setActive(true);u.moving=true;sounds.tick(g,{x:0,y:0,w:1000,h:800,z:1},new Set());u.walk=34;sounds.tick(g,{x:0,y:0,w:1000,h:800,z:1},new Set());expect(out.feet).toBe(expected);}
  });
});
