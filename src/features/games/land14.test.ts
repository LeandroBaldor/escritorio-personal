import {describe,it,expect} from 'vitest';
import {newLandGame,addUnit,stepLand} from './land';
import {previousLandMenu} from './landNavigation';
import {isBuildingBurning} from './landBuildingFire';
import {gatheringOnKnees} from './landGatherPose';
import {LandCharacterSounds} from './landCharacterSounds';
import {EVENT_CLIPS} from './landEventSounds';
import {audibleLegs,stepVolume} from './landFootsteps';
import {rigPoint} from './landRig';
import {GROUND} from './landMap';
import type {CharacterClip,SoundCue} from './landCharacterClips';
import type {CharacterSoundOutput,SoundChannel} from './landSoundOutput';
class Output implements CharacterSoundOutput{played:{file:string;channel:SoundChannel;volume:number}[]=[];stopped:SoundChannel[]=[];unlock(){}async preload(){}play(c:CharacterClip,_q:SoundCue,volume:number,_p:number,channel:SoundChannel){this.played.push({file:c.file,channel,volume});return true;}stopChannel(c:SoundChannel){this.stopped.push(c);}stop(){}dispose(){}}
const camera={x:0,y:0,w:1000,h:800,z:1};
function fixture(civ:'humano'|'elfos'|'infernal'|'enanos'|'orcos'|'sauriano'='humano'){const g=newLandGame(civ,'zergano',1,'normal',3,'small');g.units=[];g.ais.forEach(a=>a.t=Infinity);g.terrain.cells.fill(GROUND);return g;}
describe('Revisión 14: navegación, fuego, voces y recolección',()=>{
  it('regresa a la pantalla anterior real y desde la partida al menú principal',()=>{
    expect(previousLandMenu('pick')).toBe('title');expect(previousLandMenu('sheet')).toBe('pick');expect(previousLandMenu('scenario','pick')).toBe('pick');expect(previousLandMenu('scenario','sheet')).toBe('sheet');expect(previousLandMenu('playing')).toBe('title');
  });
  it('solo arden edificios terminados y dañados por un rival por debajo del 45 %',()=>{
    const g=fixture(),b=g.buildings[0];b.hp=b.maxHp*.3;expect(isBuildingBurning(b)).toBe(false);b.lastHitBy=1;expect(isBuildingBurning(b)).toBe(true);b.built=.5;expect(isBuildingBurning(b)).toBe(false);b.built=1;b.hp=b.maxHp;expect(isBuildingBurning(b)).toBe(false);b.hp=1;b.dead=.1;expect(isBuildingBurning(b)).toBe(false);
  });
  it('mezcla un único incendio visible y lo detiene al mover la cámara o al apagarse',async()=>{
    const g=fixture(),b=g.buildings[0],out=new Output(),sounds=new LandCharacterSounds(out);b.x=300;b.y=300;b.hp=100;b.lastHitBy=1;sounds.start('humano');sounds.setActive(true);
    sounds.tick(g,camera,new Set());sounds.tick(g,camera,new Set());await Promise.resolve();expect(out.played).toHaveLength(1);expect(out.played[0]).toMatchObject({file:'events/burn.mp3',channel:'ambient'});
    sounds.tick(g,{...camera,x:2000},new Set());expect(out.stopped).toContain('ambient');g.t=3;sounds.tick(g,camera,new Set());await Promise.resolve();expect(out.played).toHaveLength(2);b.dead=.1;sounds.tick(g,camera,new Set());expect(out.stopped).toHaveLength(4);
  });
  it('usa los archivos nuevos al completar una construcción o crear un personaje y descarta avisos al pausar',async()=>{
    const g=fixture(),out=new Output(),sounds=new LandCharacterSounds(out);sounds.start('humano');sounds.setActive(true);sounds.eventSound(g,'built');sounds.eventSound(g,'trained');await Promise.resolve();expect(out.played.map(p=>p.file)).toEqual(['events/built.mp3','events/trained.mp3']);
    sounds.eventSound(g,'built');sounds.setActive(false);await Promise.resolve();expect(out.played).toHaveLength(2);expect(EVENT_CLIPS.built.source).toContain('construcción.mp3');expect(EVENT_CLIPS.trained.source).toContain('personaje_creado.mp3');
  });
  it('reduce la voz y limita los pasos suaves a humanos y elfos orgánicos',async()=>{
    const out=new Output(),sounds=new LandCharacterSounds(out);sounds.start('humano');sounds.setActive(true);sounds.call('humano','worker',0);await Promise.resolve();expect(out.played[0].volume).toBeCloseTo(.45);
    expect(audibleLegs('humano','worker')).toBe(2);expect(audibleLegs('elfos','worker')).toBe(2);expect(audibleLegs('humano','elite')).toBe(0);expect(audibleLegs('enanos','worker')).toBe(0);expect(audibleLegs('orcos','worker')).toBe(0);expect(stepVolume(2)).toBeLessThan(.04);
  });
  it('arrodilla a las cinco civilizaciones solo al recolectar junto a un recurso y se levanta para caminar',()=>{
    for(const civ of ['humano','elfos','infernal','enanos','orcos'] as const){const g=fixture(civ),u=addUnit(g,0,'worker',400,300);g.nodes=[{id:999,kind:'stone',x:425,y:300,amount:100}];u.order={k:'gather',node:999};for(let i=0;i<6;i++)stepLand(g,.05);expect(gatheringOnKnees(g,u)).toBe(true);expect(u.kneel).toBe(1);u.order={k:'move',x:700,y:300};for(let i=0;i<4;i++)stepLand(g,.05);expect(gatheringOnKnees(g,u)).toBe(false);expect(u.kneel).toBe(0);}
    const standing=rigPoint(.5,.1,0,false,0),kneeling=rigPoint(.5,.1,0,false,0,1);expect(kneeling.y-standing.y).toBeGreaterThan(.15);expect(rigPoint(.3,1,0,false,0,1).y).toBeCloseTo(1);
  });
});
