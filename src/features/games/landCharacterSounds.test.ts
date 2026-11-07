import { describe,expect,it } from 'vitest';
import { addUnit,newLandGame,orderMove,stepLand } from './land';
import { GROUND } from './landMap';
import { CHARACTER_CLIPS,CHARACTER_SOUND_GAPS,type CharacterClip,type SoundCue } from './landCharacterClips';
import { LandCharacterSounds } from './landCharacterSounds';
import { footContact,walkingPhase } from './landMotion';
import type { CharacterSoundOutput,SoundChannel } from './landSoundOutput';
class Output implements CharacterSoundOutput{
  played:{clip:CharacterClip;cue:SoundCue;channel:SoundChannel}[]=[];stops=0;
  unlock(){}async preload(){}play(clip:CharacterClip,cue:SoundCue,_volume:number,_pan:number,channel:SoundChannel){this.played.push({clip,cue,channel});return true;}
  stop(){this.stops++;}dispose(){this.stop();}
}
const camera={x:0,y:0,w:1200,h:800,z:1};
function fixture(){const g=newLandGame('humano','orcos',5,'normal',42,'small');g.units=[];g.ai.t=Infinity;const unit=addUnit(g,0,'worker',400,300),out=new Output(),sound=new LandCharacterSounds(out);sound.start('humano');sound.setActive(true);return {g,unit,out,sound};}
describe('Audios de los personajes de Land',()=>{
  it('incluye 72 archivos, las diez civilizaciones y 60 personajes con audio propio',()=>{
    expect(CHARACTER_CLIPS).toHaveLength(72);expect(new Set(CHARACTER_CLIPS.map(c=>c.civ)).size).toBe(10);
    expect(new Set(CHARACTER_CLIPS.filter(c=>c.role!=='acid').map(c=>c.civ+':'+c.role)).size).toBe(60);
    expect(CHARACTER_SOUND_GAPS).toEqual([]);
    expect(CHARACTER_CLIPS.find(c=>c.civ==='humano'&&c.role==='heavy')?.purpose).toBe('call');
    expect(CHARACTER_CLIPS.find(c=>c.civ==='mecanico'&&c.role==='worker')?.source).toContain('oron.mp3');
  });
  it('todos los fragmentos están dentro del audio y los elfos conservan frases melódicas de hasta cuatro segundos',()=>{
    for(const clip of CHARACTER_CLIPS){for(const cue of [...clip.phrases,...clip.steps]){expect(cue.start).toBeGreaterThanOrEqual(0);expect(cue.duration).toBeGreaterThan(0);expect(cue.start+cue.duration).toBeLessThanOrEqual(clip.duration+.002);expect(cue.rms).toBeGreaterThanOrEqual(0);}}
    const elven=CHARACTER_CLIPS.filter(c=>c.civ==='elfos'&&c.purpose==='call');expect(elven.some(c=>c.phrases.some(p=>p.duration>3))).toBe(true);
    expect(elven.every(c=>c.phrases.every(p=>p.duration<=4.03))).toBe(true);
  });
  it('reutiliza la grabación idéntica de pasos humanos por su hash',()=>{
    const clips=CHARACTER_CLIPS.filter(c=>c.civ==='humano'&&c.purpose==='foot'&&c.role!=='elite');expect(clips).toHaveLength(4);expect(new Set(clips.map(c=>c.hash)).size).toBe(1);
  });
  it('sincroniza un impacto por apoyo alternado del pie, sin repetirlo por fotograma',()=>{
    const {g,unit,out,sound}=fixture();unit.moving=true;unit.walk=16;sound.tick(g,camera,new Set());expect(out.played).toHaveLength(0);
    unit.walk=17;sound.tick(g,camera,new Set());sound.tick(g,camera,new Set());expect(out.played).toHaveLength(1);expect(out.played[0].channel).toBe('foot');
    unit.walk=51;sound.tick(g,camera,new Set());expect(out.played).toHaveLength(2);expect(walkingPhase(17)).toBeCloseTo(Math.PI/2);expect(footContact(51)).toBe(2);
    unit.moving=false;unit.walk=85;sound.tick(g,camera,new Set());expect(out.played).toHaveLength(2);
  });
  it('no reproduce pasos lejanos ni acumula apoyos al volver a la cámara',()=>{
    const {g,unit,out,sound}=fixture();unit.moving=true;sound.tick(g,camera,new Set());unit.x=10000;unit.walk=170;sound.tick(g,camera,new Set());
    unit.x=400;sound.tick(g,camera,new Set());expect(out.played).toHaveLength(0);unit.walk=187;sound.tick(g,camera,new Set());expect(out.played).toHaveLength(1);
  });
  it('detiene los sonidos y descarta voces pendientes al pausar o salir',async()=>{
    const {g,out,sound}=fixture();g.sides[0].civ='elfos';sound.call('elfos','worker',0);sound.setActive(false);await Promise.resolve();expect(out.played).toHaveLength(0);expect(out.stops).toBe(1);
    sound.tick(g,camera,new Set());sound.react(g,[g.units[0].id]);expect(out.played).toHaveLength(0);
  });
  it('usa las voces humanas cortas y no mezcla la caminata con la confirmación',async()=>{
    const {g,unit,out,sound}=fixture();sound.react(g,[unit.id]);await Promise.resolve();expect(out.played).toHaveLength(1);expect(out.played[0].clip.file).toBe('humano/worker-2.mp3');expect(out.played[0].channel).toBe('call');
  });
  it('usa el ácido zergano en el disparo especial y respeta su intervalo',()=>{
    const {g,out,sound}=fixture();g.sides[0].civ='zergano';expect(sound.attack(g,0,'special')).toBe(true);expect(out.played[0].clip.role).toBe('acid');expect(sound.attack(g,0,'special')).toBe(false);
  });
  it('la distancia de caminata no aumenta cuando el personaje está quieto',()=>{
    const {g,unit}=fixture();g.terrain.cells.fill(GROUND);orderMove(g,[unit.id],unit.x+300,unit.y);const x=unit.x;stepLand(g,.1);expect(unit.walk).toBeCloseTo(unit.x-x);expect(unit.moving).toBe(true);
    unit.order={k:'idle'};const walk=unit.walk;stepLand(g,.1);expect(unit.walk).toBe(walk);expect(unit.moving).toBe(false);
  });
});
