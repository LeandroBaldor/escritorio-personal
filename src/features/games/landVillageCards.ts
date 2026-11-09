import {ROLES,unitStats,type LandGame,type Role,type ResKind,type Building} from './land';
import {TRAINING_KIND} from './landCivs';
import {evolutionCost,evolutionTime,structureUpgradeCost,structureUpgradeTime,STRUCTURE_UPGRADES} from './landBalance';
export function unitScores(game:LandGame,owner:number,role:Role){const s=unitStats(game,owner,role),max=unitStats(game,owner,role,4),score=(value:number,limit:number)=>Math.max(0,Math.min(100,Math.round(value/limit*100)));return {resistance:score(s.hp,max.hp),power:score(Math.max(s.dmg,s.heal??0),Math.max(max.dmg,max.heal??0)),force:score(s.dmg*(s.vsBuild??1)*(role==='worker'?.3:1),max.dmg*(max.vsBuild??1)*(role==='worker'?.3:1))};}
export function barracksMembers(game:LandGame,building:Building){return game.units.filter(u=>!u.dead&&u.owner===building.owner&&u.trainedAt===building.id);}
export function villageRoster(game:LandGame,owner=0){return ROLES.map(role=>({role,level:game.sides[owner].levels[role],units:game.units.filter(u=>!u.dead&&u.owner===owner&&u.role===role)}));}
export function resourceImprovement(game:LandGame,owner:number,kind:ResKind|'food'){
 const side=game.sides[owner];let done=0,total=0;
 for(const role of ROLES){if(kind==='food'&&role!=='worker')continue;for(let level=1;level<4;level++){if(kind!=='food'&&!(evolutionCost(level,role)[kind]>0))continue;total++;if(side.levels[role]>level)done++;else if(side.levels[role]===level){const b=game.buildings.find(b=>b.owner===owner&&!b.dead&&b.kind===TRAINING_KIND[role]&&b.evolving);if(b)done+=Math.min(1,b.rT/evolutionTime(level));}}}
 if(kind!=='food')for(const tech of STRUCTURE_UPGRADES)for(let level=0;level<3;level++){if(!((structureUpgradeCost(tech,level)[kind]??0)>0))continue;total++;if(side.infrastructure[tech]>level)done++;else if(side.infrastructure[tech]===level){const research=game.buildings.find(b=>b.owner===owner&&!b.dead&&b.infrastructureResearch?.kind===tech)?.infrastructureResearch;if(research)done+=Math.min(1,research.elapsed/structureUpgradeTime(level));}}
 return total?Math.round(done/total*100):0;
}
