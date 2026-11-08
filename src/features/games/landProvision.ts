import type {CivId} from './landCivs';
import type {LandGame,Role} from './land';
export const FOOD_CAPACITY=800, HARVEST_TIME=60, HARVEST_YIELD=60;
export const FOOD_WEIGHT:Record<Role,number>={worker:0,melee:1,ranged:1.2,special:2,heavy:4,elite:6};
export const FOOD_NAMES:Record<CivId,string>={humano:'cereales y raciones',elfos:'frutos del bosque',enanos:'hongos y tubérculos',orcos:'raíces y carne de cría',sauriano:'carne de criadero',zergano:'biomasa nutritiva',nomuerta:'hongos de esencia',infernal:'frutos de ceniza',mecanico:'biocombustible',abisal:'algas abisales'};
import {evolutionLevel} from './landBalance';
export {MAX_EVOLUTION,evolutionLevel,evolutionTime,evolutionCost,EVOLUTION_NAMES} from './landBalance';
export const unitFoodRate=(g:LandGame,owner:number,role:Role)=>FOOD_WEIGHT[role]*(1+(evolutionLevel(g,owner,role)-1)*.12);
export function foodRate(g:LandGame,owner:number){return g.units.filter(u=>u.owner===owner&&!u.dead).reduce((n,u)=>n+unitFoodRate(g,owner,u.role),0);}
export const foodPercent=(g:LandGame,owner=0)=>Math.round(g.sides[owner].food/FOOD_CAPACITY*100);
export const foodBlocked=(g:LandGame,owner:number,role:Role)=>role!=='worker'&&g.sides[owner].food<=0;
