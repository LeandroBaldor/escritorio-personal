import {describe,it,expect} from 'vitest';
import {addUnit,newLandGame,stepLand,takeLandEvents} from './land';
import {CIV_IDS} from './landCivs';
import {COMBAT_CLIPS,weaponSound} from './landCombat';
import {LandLeaderReports,missingResources,readySoldiers} from './landLeader';
import {LandCharacterSounds} from './landCharacterSounds';
import type {CharacterClip,SoundCue} from './landCharacterClips';
import type {CharacterSoundOutput,SoundChannel} from './landSoundOutput';
import {GROUND} from './landMap';
import {deathStyle} from './landDeath';
function fixture(){const g=newLandGame('humano',['orcos','zergano'],1,'normal',99,'small');g.units=[];g.terrain.cells.fill(GROUND);g.ais.forEach(a=>a.t=Infinity);return g;}
class Output implements CharacterSoundOutput{
  played:{clip:CharacterClip;channel:SoundChannel}[]=[];
  unlock(){}async preload(){}play(clip:CharacterClip,_cue:SoundCue,_volume:number,_pan:number,channel:SoundChannel){this.played.push({clip,channel});return true;}stop(){}dispose(){}
}
describe('Revisión 11: líder y combate',()=>{
  it('usa sangre roja para humanos, enanos y elfos y adapta los bichos al diseño de su unidad',()=>{
    for(const civ of ['humano','enanos','elfos'] as const)expect(deathStyle(civ,'melee')).toEqual({fire:false,color:'#d92132'});
    expect(deathStyle('zergano','special').color).toBe('#91bf2d');expect(deathStyle('zergano','heavy').color).toBe('#ba7438');expect(deathStyle('mecanico','ranged').fire).toBe(true);
  });
  it('identifica amenazas cercanas, sin revelar ejércitos lejanos ni repetir cada segundo',()=>{
    const g=fixture(),reports=new LandLeaderReports();addUnit(g,0,'worker',300,300);const enemy=addUnit(g,1,'ranged',500,300);enemy.order={k:'move',x:300,y:300,attack:true};const far=addUnit(g,2,'elite',3000,2000);far.order={k:'move',x:300,y:300,attack:true};
    expect(reports.tick(g).join(' ')).toContain('Cazador de Fieras (Clanes Orcos)');g.t=1;expect(reports.tick(g)).toEqual([]);
  });
  it('cuenta bajas de la batalla propia y no combates entre otras computadoras',()=>{
    const g=fixture(),reports=new LandLeaderReports();addUnit(g,0,'ranged',300,300);reports.event(g,{type:'attacked'});
    reports.event(g,{type:'die',owner:0,by:1,building:false,x:300,y:300});reports.event(g,{type:'die',owner:1,by:0,building:false,x:3000,y:2000});reports.event(g,{type:'die',owner:2,by:1,building:false,x:300,y:300});g.t=4;
    expect(reports.tick(g).join(' ')).toContain('1 bajas propias y 1 bajas enemigas');g.t=12;expect(reports.tick(g).join(' ')).toContain('Terminó el enfrentamiento');g.t=13;expect(reports.tick(g)).toEqual([]);
  });
  it('informa el balance final también al ganar y no cuenta trabajadores o médicos como combatientes',()=>{
    const g=fixture(),reports=new LandLeaderReports();addUnit(g,0,'worker',300,300);addUnit(g,0,'special',300,300);addUnit(g,0,'ranged',300,300);expect(readySoldiers(g)).toBe(1);
    reports.event(g,{type:'attacked'});g.phase='won';expect(reports.tick(g).join(' ')).toContain('0 bajas propias y 0 bajas enemigas');
  });
  it('especifica recursos faltantes y avisa reservas bajas con límite de frecuencia',()=>{
    const g=fixture(),reports=new LandLeaderReports();g.sides[0].stone=10;g.sides[0].gem=5;g.sides[0].energy=0;
    expect(missingResources(g,{stone:100,gem:25,energy:16})).toBe('Nos faltan 90 cristales azules y 20 cristales dorados y 16 cristales verdes para completar esta orden.');
    g.t=16;expect(reports.tick(g).join(' ')).toContain('reservas de cristales azules');g.t=20;expect(reports.tick(g)).toEqual([]);
  });
  it('incluye los diez archivos y asigna cada arma de las diez civilizaciones',()=>{
    expect(Object.keys(COMBAT_CLIPS)).toHaveLength(10);for(const civ of CIV_IDS)for(const role of ['melee','ranged','heavy','elite'] as const)expect(COMBAT_CLIPS[weaponSound(civ,role)]).toBeDefined();
    expect(weaponSound('humano','heavy')).toBe('cannon');expect(weaponSound('humano','ranged')).toBe('machine');expect(weaponSound('elfos','ranged')).toBe('arrow');expect(weaponSound('mecanico','ranged')).toBe('laser');
    for(const clip of Object.values(COMBAT_CLIPS))for(const cue of clip.phrases){expect(cue.start+cue.duration).toBeLessThanOrEqual(clip.duration+.002);expect(cue.duration).toBeGreaterThan(0);}
  });
  it('emite un impacto en el edificio golpeado y una muerte por unidad',()=>{
    const g=fixture(),target=g.buildings.find(b=>b.owner===1)!;target.hp=2000;const u=addUnit(g,0,'heavy',target.x+150,target.y);u.order={k:'attack',id:target.id};stepLand(g,.05);expect(takeLandEvents(g)).toContainEqual({type:'impact',owner:0,x:target.x,y:target.y});
    g.units=[];const victim=addUnit(g,1,'worker',300,300),killer=addUnit(g,0,'ranged',350,300);victim.hp=1;killer.order={k:'attack',id:victim.id};stepLand(g,.05);expect(takeLandEvents(g).filter(e=>e.type==='die')).toEqual([{type:'die',owner:1,by:0,building:false,x:victim.x,y:victim.y}]);
    stepLand(g,.05);expect(takeLandEvents(g).filter(e=>e.type==='die')).toEqual([]);
  });
  it('reproduce impactos y muertes en sus canales y descarta sonidos pendientes al pausar',async()=>{
    const g=fixture(),out=new Output(),sound=new LandCharacterSounds(out);sound.start('humano');sound.setActive(true);
    sound.combat(g,{type:'impact',owner:0,x:300,y:300});sound.combat(g,{type:'die',owner:1,building:false,x:300,y:300});await Promise.resolve();expect(out.played.map(p=>[p.clip.file,p.channel])).toEqual([['combat/building.mp3','effect'],['combat/death.mp3','death']]);
    g.t=1;sound.combat(g,{type:'shot',owner:0,role:'heavy',x:300,y:300});sound.setActive(false);await Promise.resolve();expect(out.played).toHaveLength(2);
  });
});
