import {ROLE_STATS,ROLES,unitStats,type LandGame,type Role,type ResKind,type Building} from './land';
import {CIVS,CIV_IDS,TRAINING_KIND} from './landCivs';
import {LEVEL_HEALTH,LEVEL_DAMAGE,evolutionCost,evolutionTime,structureUpgradeCost,structureUpgradeTime,STRUCTURE_UPGRADES} from './landBalance';
const references=CIV_IDS.flatMap(civ=>ROLES.map(role=>{const s={...ROLE_STATS[role],...CIVS[civ].mod[role]};return {hp:s.hp*LEVEL_HEALTH[4],power:Math.max(s.dmg,s.heal??0)*LEVEL_DAMAGE[4],force:s.dmg*(s.vsBuild??1)*(role==='worker'?.3:1)*LEVEL_DAMAGE[4]};}));
export const SCORE_REFERENCE={resistance:Math.max(...references.map(s=>s.hp)),power:Math.max(...references.map(s=>s.power)),force:Math.max(...references.map(s=>s.force))};
export function unitScores(game:LandGame,owner:number,role:Role){const s=unitStats(game,owner,role),score=(value:number,max:number)=>Math.max(0,Math.min(100,Math.round(value/max*100)));return {resistance:score(s.hp,SCORE_REFERENCE.resistance),power:score(Math.max(s.dmg,s.heal??0),SCORE_REFERENCE.power),force:score(s.dmg*(s.vsBuild??1)*(role==='worker'?.3:1),SCORE_REFERENCE.force)};}
export function barracksMembers(game:LandGame,building:Building){return game.units.filter(u=>!u.dead&&u.owner===building.owner&&u.trainedAt===building.id);}
export function villageRoster(game:LandGame,owner=0){return ROLES.map(role=>({role,level:game.sides[owner].levels[role],units:game.units.filter(u=>!u.dead&&u.owner===owner&&u.role===role)}));}
export function resourceImprovement(game:LandGame,owner:number,kind:ResKind|'food'){
 const side=game.sides[owner];let done=0,total=0;
 for(const role of ROLES){if(kind==='food'&&role!=='worker')continue;for(let level=1;level<4;level++){if(kind!=='food'&&!(evolutionCost(level,role)[kind]>0))continue;total++;if(side.levels[role]>level)done++;else if(side.levels[role]===level){const b=game.buildings.find(b=>b.owner===owner&&!b.dead&&b.kind===TRAINING_KIND[role]&&b.evolving);if(b)done+=Math.min(1,b.rT/evolutionTime(level));}}}
 if(kind!=='food')for(const tech of STRUCTURE_UPGRADES)for(let level=0;level<3;level++){if(!((structureUpgradeCost(tech,level)[kind]??0)>0))continue;total++;if(side.infrastructure[tech]>level)done++;else if(side.infrastructure[tech]===level){const research=game.buildings.find(b=>b.owner===owner&&!b.dead&&b.infrastructureResearch?.kind===tech)?.infrastructureResearch;if(research)done+=Math.min(1,research.elapsed/structureUpgradeTime(level));}}
 return total?Math.round(done/total*100):0;
}
