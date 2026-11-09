import type {LandGame,Unit} from './land';
import {extractingResource,harvestingFood} from './landGatherPose';
import {STEP_DISTANCE,stopMotionPhase} from './landMotion';
import {unitScale} from './landBalance';
import {evolutionLevel} from './landProvision';
export type UnitAction='idle'|'walk'|'attack'|'mine'|'harvest';
export interface UnitAnimation{action:UnitAction;phase:number;facing?:'front'|'back'|'side'}
export const miningBeat=(u:Unit)=>Math.floor((u.mineT+.4)/.8);
export const animationWalkDistance=(g:LandGame,u:Unit)=>u.walk/unitScale(g.sides[u.owner].civ,u.role,evolutionLevel(g,u.owner,u.role));
export const cycle=(n:number)=>((n%1)+1)%1;
export const animationFrame=(phase:number,count:number,loop=true)=>Math.min(count-1,Math.floor((loop?cycle(phase):Math.max(0,Math.min(.999999,phase)))*count));
export function unitAnimation(g:LandGame,u:Unit):UnitAnimation{
  if(u.dead)return {action:'idle',phase:0};
  if(u.moving)return {action:'walk',phase:stopMotionPhase(animationWalkDistance(g,u)*Math.PI/STEP_DISTANCE)/(Math.PI*2),facing:u.heading??'front'};
  if(extractingResource(g,u))return {action:'mine',phase:cycle(u.mineT/.8)};
  if(harvestingFood(g,u))return {action:'harvest',phase:cycle(u.mineT/1.2)};
  if(u.atkT>=0)return {action:'attack',phase:Math.min(1,u.atkT/.35)};
  return {action:'idle',phase:0,facing:u.heading??'front'};
}
