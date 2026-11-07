import { BUILD_STATS, type LandGame, type Unit } from './land';
import { CIVS } from './landCivs';
export type ActivityKind='idle'|'move'|'gather'|'build'|'attack';
export interface TroopActivity {kind:ActivityKind;label:string;detail:string}
export function troopActivity(g:LandGame,u:Unit):TroopActivity{
  const o=u.order;
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
  const resource=kind==='energy'?'cristales verdes':kind==='gem'?'cristales dorados':kind==='stone'?'cristales azules':'recursos';
  if(u.carry>0)return {kind:'gather',label:'Transportando recursos',detail:`${u.carry} ${resource} hacia un depósito`};
  const close=node&&Math.hypot(u.x-node.x,u.y-node.y)<=28;
  return {kind:'gather',label:close?'Recolectando':'Buscando recursos',detail:resource.charAt(0).toUpperCase()+resource.slice(1)};
}
