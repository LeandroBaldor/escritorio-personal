import type {CivId} from './landCivs';
import type {LandGame,Role} from './land';
export const FOOD_CAPACITY=500, HARVEST_TIME=60, HARVEST_YIELD=30;
export const FOOD_WEIGHT:Record<Role,number>={worker:0,melee:1,ranged:1.2,special:2,heavy:4,elite:6};
export const FOOD_NAMES:Record<CivId,string>={humano:'cereales y raciones',elfos:'frutos del bosque',enanos:'hongos y tubérculos',orcos:'raíces y carne de cría',sauriano:'carne de criadero',zergano:'biomasa nutritiva',nomuerta:'hongos de esencia',infernal:'frutos de ceniza',mecanico:'biocombustible',abisal:'algas abisales'};
export const MAX_EVOLUTION=4;
export const evolutionLevel=(g:LandGame,owner:number,role:Role)=>g.sides[owner].levels[role];
export const evolutionTime=(level:number)=>25+level*10;
export const evolutionCost=(level:number)=>({stone:100*(level+1),gem:60*(level+1),energy:16*(level+1),rock:35*(level+1)});
export function foodRate(g:LandGame,owner:number){return g.units.filter(u=>u.owner===owner&&!u.dead).reduce((n,u)=>n+FOOD_WEIGHT[u.role]*(1+evolutionLevel(g,owner,u.role)*.15),0);}
export const foodPercent=(g:LandGame,owner=0)=>Math.round(g.sides[owner].food/FOOD_CAPACITY*100);
export const foodBlocked=(g:LandGame,owner:number,role:Role)=>role!=='worker'&&g.sides[owner].food<=0;
export const EVOLUTION_NAMES=['Original','Blindado','Veterano','Campeón','Ascendido'];
