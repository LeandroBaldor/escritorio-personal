import {ROLES,type LandGame,type ResKind,type Unit} from './land';
import {CIVS} from './landCivs';
import {populationActivities} from './landInspection';
import {evolutionLevel} from './landProvision';
export type VillageCategory=ResKind|'food'|'army'|'other'|'all';
export const VILLAGE_CATEGORIES:VillageCategory[]=['stone','gem','energy','rock','food','army','other','all'];
export const VILLAGE_LABELS:Record<VillageCategory,string>={stone:'Azules',gem:'Dorados',energy:'Verdes',rock:'Piedras',food:'Comida',army:'Soldados',other:'Otros',all:'Todos'};
export function villageBuckets(g:LandGame,owner:number){
 const buckets:Record<VillageCategory,Unit[]>={stone:[],gem:[],energy:[],rock:[],food:[],army:[],other:[],all:[]},nodes=new Map(g.nodes.map(n=>[n.id,n.kind]));
 for(const u of g.units){if(u.dead||u.owner!==owner)continue;buckets.all.push(u);if(u.role!=='worker')buckets.army.push(u);
  const order=u.order,kind=order.k==='gather'?nodes.get(order.node)??u.carryKind:null;
  if(kind&&kind!=='food')buckets[kind].push(u);else if(order.k==='farm')buckets.food.push(u);else if(u.role==='worker')buckets.other.push(u);
 }return buckets;
}
export const villageMembers=(g:LandGame,owner:number,category:VillageCategory)=>villageBuckets(g,owner)[category];
export function villageDetails(g:LandGame,owner:number,category:VillageCategory){const units=villageMembers(g,owner,category);
  if(category==='army')return ROLES.filter(role=>role!=='worker').flatMap(role=>{const members=units.filter(u=>u.role===role);return members.length?[{name:CIVS[g.sides[owner].civ].units[role],count:members.length,label:`Nivel ${evolutionLevel(g,owner,role)} / 4`}]:[];});
  return populationActivities({...g,units},owner).flatMap(group=>group.tasks.map(task=>({name:group.name,...task})));
}
