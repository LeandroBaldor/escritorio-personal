import { BUILD_STATS, type LandGame, type Unit } from './land';
import { CIVS } from './landCivs';
import {foodBlocked,FOOD_NAMES} from './landProvision';
import type { Role } from './land';
export type ActivityKind='idle'|'move'|'gather'|'build'|'attack';
export interface TroopActivity {kind:ActivityKind;label:string;detail:string}
export interface TroopGroup {key:string;role:Role;kind:ActivityKind;task:string;units:Unit[]}
export function troopGroups(g:LandGame):TroopGroup[]{
  const groups=new Map<string,TroopGroup>();
  for(const u of g.units){
    if(u.owner!==0||u.dead)continue;
    const o=u.order,activity=troopActivity(g,u);let mission:string=activity.kind,task=activity.label;
    if(o.k==='gather'){
      const resource=u.carryKind??g.nodes.find(n=>n.id===o.node)?.kind;
      mission=`gather:${resource??'resources'}`;
      task=`Recolección de ${resource==='gem'?'oro':resource==='stone'?'cristales azules':resource==='energy'?'cristales verdes':resource==='rock'?'piedras':'recursos'}`;
    }else if(o.k==='farm'){mission='farm';task='Cultivo y entrega de alimentos';
    }else if(o.k==='build'){
      const b=g.buildings.find(q=>q.id===o.id&&!q.dead&&q.built<1);
      if(b){mission=`build:${b.kind}`;task=`Construcción de ${CIVS[g.sides[b.owner].civ].buildings[b.kind]}`;}
    }else if(o.k==='attack'){mission=`attack:${activity.detail}`;task=`Combate · ${activity.detail.replace('Objetivo: ','')}`;}
    else if(o.k==='move'){mission=`move:${!!o.attack}`;task=o.attack?'Avance de combate':'Marchando';}
    const key=`${u.role}:${mission}`,group=groups.get(key);
    if(group)group.units.push(u);else groups.set(key,{key,role:u.role,kind:activity.kind,task,units:[u]});
  }
  const rank={attack:0,build:1,gather:2,move:3,idle:4};
  return [...groups.values()].sort((a,b)=>rank[a.kind]-rank[b.kind]||a.units[0].id-b.units[0].id);
}
export function troopGroupName(name:string,count:number){
  if(count===1)return name;
  const words=name.split(' ');let complement=false;
  return words.map(word=>{
    if(['de','del'].includes(word.toLowerCase()))complement=true;
    if(complement||['Bastión','T-Rex'].includes(word))return word;
    if(/ón$/.test(word))return word.slice(0,-2)+'ones';
    if(/án$/.test(word))return word.slice(0,-2)+'anes';
    if(/ín$/.test(word))return word.slice(0,-2)+'ines';
    return word+(/[aeiouáéíóú]$/i.test(word)?'s':'es');
  }).join(' ');
}
export function troopActivity(g:LandGame,u:Unit):TroopActivity{
  const o=u.order;
  if(foodBlocked(g,u.owner,u.role))return {kind:'idle',label:'Sin alimento',detail:'Esperando una entrega en el Almacén'};
  if(o.k==='farm'){
    const store=g.buildings.some(b=>b.owner===u.owner&&!b.dead&&b.built>=1&&b.kind==='storehouse');
    return {kind:'gather',label:u.carryKind==='food'?(store?'Entregando alimentos':'Esperando Almacén'):u.moving?'Yendo a la cosecha':'Cultivando alimentos',detail:u.carryKind==='food'&&!store?'Construí un Almacén. Podés dar otra orden al trabajador.':FOOD_NAMES[g.sides[u.owner].civ]};
  }
  if(o.k==='idle')return {kind:'idle',label:'En espera',detail:'Lista para recibir órdenes'};
  if(o.k==='move')return {kind:'move',label:o.attack?'Avanzando en combate':'Marchando',detail:'En camino al destino señalado'};
  if(o.k==='attack'){
    const unit=g.units.find(q=>q.id===o.id&&!q.dead),building=g.buildings.find(q=>q.id===o.id&&!q.dead);
    const target=unit?CIVS[g.sides[unit.owner].civ].units[unit.role]:building?CIVS[g.sides[building.owner].civ].buildings[building.kind]:'objetivo enemigo';
    return {kind:'attack',label:'Combatiendo',detail:`Objetivo: ${target}`};
  }
  if(o.k==='build'){
    const b=g.buildings.find(q=>q.id===o.id&&!q.dead);
    if(!b)return {kind:'idle',label:'Finalizando tarea',detail:'La obra ya no está disponible'};
    const close=Math.hypot(u.x-b.x,u.y-b.y)<=BUILD_STATS[b.kind].size*.45+2;
    return {kind:'build',label:close?'Construyendo':'Yendo a la obra',detail:`${CIVS[g.sides[b.owner].civ].buildings[b.kind]} · ${Math.floor(b.built*100)}%`};
  }
  const node=g.nodes.find(n=>n.id===o.node),kind=u.carryKind??node?.kind;
  const resource=kind==='energy'?'cristales verdes':kind==='gem'?'cristales dorados':kind==='stone'?'cristales azules':kind==='rock'?'piedras':'recursos';
  if(u.carry>0)return {kind:'gather',label:'Transportando recursos',detail:`${u.carry} ${resource} hacia un depósito`};
  const close=node&&Math.hypot(u.x-node.x,u.y-node.y)<=28;
  return {kind:'gather',label:close?'Recolectando':'Buscando recursos',detail:resource.charAt(0).toUpperCase()+resource.slice(1)};
}
