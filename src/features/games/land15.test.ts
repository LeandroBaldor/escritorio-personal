import {describe,it,expect} from 'vitest';
import {newLandGame,addUnit} from './land';
import {LandCharacterSounds} from './landCharacterSounds';
import {extractingResource} from './landGatherPose';
import {EVENT_CLIPS} from './landEventSounds';
import type {CharacterClip,SoundCue} from './landCharacterClips';
import type {CharacterSoundOutput,SoundChannel} from './landSoundOutput';
class Output implements CharacterSoundOutput{played:{file:string;channel:SoundChannel}[]=[];stopped:SoundChannel[]=[];unlock(){}async preload(){}play(c:CharacterClip,_q:SoundCue,_v:number,_p:number,channel:SoundChannel){this.played.push({file:c.file,channel});return true;}stopChannel(c:SoundChannel){this.stopped.push(c);}stop(){}dispose(){}}
const cam={x:0,y:0,w:1000,h:800,z:1};
function fixture(){const g=newLandGame('humano','orcos',1,'normal',3,'small');g.units=[];g.nodes=[{id:999,kind:'stone',x:420,y:300,amount:100}];const worker=addUnit(g,0,'worker',400,300);worker.order={k:'gather',node:999};const out=new Output(),sound=new LandCharacterSounds(out);sound.start('humano');sound.setActive(true);return {g,worker,out,sound};}
describe('Revisión 15: excavación',()=>{
  it('reproduce una sola excavación aunque haya varios trabajadores extrayendo',async()=>{const {g,out,sound}=fixture();const another=addUnit(g,0,'worker',405,300);another.order={k:'gather',node:999};sound.tick(g,cam,new Set());sound.tick(g,cam,new Set());await Promise.resolve();expect(out.played).toEqual([{file:'events/dig.mp3',channel:'dig'}]);g.t=1.1;sound.tick(g,cam,new Set());await Promise.resolve();expect(out.played).toHaveLength(2);expect(EVENT_CLIPS.dig.source).toBe('SONIDOS/excavacion.mp3');});
  it('no suena al caminar hacia la mina o volver cargado y se detiene al salir de cámara',async()=>{const {g,worker,out,sound}=fixture();worker.moving=true;expect(extractingResource(g,worker)).toBe(false);sound.tick(g,cam,new Set());await Promise.resolve();expect(out.played).toEqual([]);worker.moving=false;worker.carry=8;sound.tick(g,cam,new Set());await Promise.resolve();expect(out.played).toEqual([]);worker.carry=0;sound.tick(g,cam,new Set());await Promise.resolve();expect(out.played).toHaveLength(1);sound.tick(g,{...cam,x:2000},new Set());expect(out.stopped).toContain('dig');});
  it('descarta el sonido que termina de cargar después de cancelar o pausar',async()=>{const {g,worker,out,sound}=fixture();sound.tick(g,cam,new Set());worker.order={k:'idle'};await Promise.resolve();expect(out.played).toEqual([]);worker.order={k:'gather',node:999};g.t=2;sound.tick(g,cam,new Set());sound.setActive(false);await Promise.resolve();expect(out.played).toEqual([]);});
});
