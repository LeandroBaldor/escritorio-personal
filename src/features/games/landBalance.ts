import {CIVS,type CivId} from './landCivs';
import type {Cost,LandGame,Role} from './land';
export const MAX_EVOLUTION=4;
export const LEVEL_HEALTH=[0,2.4,4,6.2,8.5];
export const LEVEL_DAMAGE=[0,1,1.4,2,2.8];
export const LEVEL_SPEED=[0,1,1.06,1.12,1.18];
export const LEVEL_RANGE=[0,1,1.06,1.12,1.18];
export const LEVEL_CADENCE=[0,1,1.05,1.1,1.16];
export const levelIndex=(level:number)=>Math.max(1,Math.min(4,Math.floor(level)));
export function unitScale(civ:CivId,role:Role,level:number){
  const giant=!['humano','elfos','enanos'].includes(civ)||civ==='elfos'&&(role==='heavy'||role==='elite')||civ==='enanos'&&role==='elite';
  return (giant?[0,1,1.3,1.7,2.15]:[0,1,1.07,1.16,1.28])[levelIndex(level)];
}
export function evolutionCost(level:number,role:Role='melee'):Required<Cost>{
  const base=[{stone:100,gem:50,energy:0,rock:20},{stone:180,gem:100,energy:25,rock:40},{stone:300,gem:180,energy:60,rock:70}][Math.min(2,Math.max(0,level-1))];
  const factor=({worker:.65,melee:1,ranged:1,special:1.1,heavy:1.3,elite:1.5} as const)[role];
  const round=(n:number)=>Math.ceil(n*factor/5)*5;
  return {stone:round(base.stone),gem:round(base.gem),energy:round(base.energy),rock:round(base.rock)};
}
export const evolutionTime=(level:number)=>[0,20,30,40,40][levelIndex(level)];
export const evolutionLevel=(g:LandGame,owner:number,role:Role)=>levelIndex(g.sides[owner].levels[role]);
export const unitLabel=(g:LandGame,owner:number,role:Role)=>`${CIVS[g.sides[owner].civ].units[role]} Nivel ${evolutionLevel(g,owner,role)}`;
export const EVOLUTION_NAMES=['','Inicial','Veterano','Campeón','Ascendido'];
export const affordableTrainingCost=(cost:Cost):Cost=>({stone:Math.ceil(cost.stone*.6/5)*5,gem:Math.ceil(cost.gem*.6/5)*5,energy:Math.ceil((cost.energy??0)*.6/5)*5});
export const costDescription=(c:Cost)=>[c.stone?`${c.stone} azules`:'',c.gem?`${c.gem} dorados`:'',c.energy?`${c.energy} verdes`:'',c.rock?`${c.rock} piedras`:''].filter(Boolean).join(' · ');
export type StructureUpgrade='production'|'fortification';
export const STRUCTURE_UPGRADES:StructureUpgrade[]=['production','fortification'];
export const STRUCTURE_NAMES:Record<StructureUpgrade,string>={production:'Producción',fortification:'Fortificación'};
export const MAX_STRUCTURE_LEVEL=3;
export const PRODUCTION_TIME=[1,.8,.65,.5],CONSTRUCTION_TIME=[1,.9,.8,.7],STRUCTURE_HEALTH=[1,1.5,2.2,3],STRUCTURE_PROTECTION=[0,.1,.18,.25];
export function structureUpgradeCost(kind:StructureUpgrade,level:number):Cost{
  const costs:Record<StructureUpgrade,Cost[]>={production:[{stone:160,gem:100,rock:40},{stone:300,gem:180,energy:25,rock:80},{stone:480,gem:300,energy:60,rock:140}],fortification:[{stone:100,gem:0,rock:140},{stone:200,gem:30,energy:20,rock:260},{stone:340,gem:70,energy:50,rock:400}]};
  return {...costs[kind][Math.min(2,Math.max(0,level))]};
}
export const structureUpgradeTime=(level:number)=>25+level*10;
export function structureBenefit(kind:StructureUpgrade,level:number){const next=Math.min(3,level+1);return kind==='production'?`Entrenamiento: −${Math.round((1-PRODUCTION_TIME[level])*100)}% → −${Math.round((1-PRODUCTION_TIME[next])*100)}%. Obras: −${Math.round((1-CONSTRUCTION_TIME[next])*100)}%.`:`Vida: ×${STRUCTURE_HEALTH[level]} → ×${STRUCTURE_HEALTH[next]}. Reducción de daño: ${Math.round(STRUCTURE_PROTECTION[level]*100)}% → ${Math.round(STRUCTURE_PROTECTION[next]*100)}%.`;}
