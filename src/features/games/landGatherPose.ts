import {unitStats,type LandGame,type Unit} from './land';
import {resourceReach} from './landTactics';
export function extractingResource(g:LandGame,u:Unit){if(u.dead||u.moving||u.order.k!=='gather'||u.carry>0)return false;const id=u.order.node,node=g.nodes.find(n=>n.id===id&&n.amount>0);return !!node&&Math.hypot(node.x-u.x,node.y-u.y)<=resourceReach(unitStats(g,u.owner,u.role).size);}
export function harvestingFood(g:LandGame,u:Unit){if(u.dead||u.moving||u.carry>0||u.order.k!=='farm')return false;const id=u.order.id,farm=g.buildings.find(b=>b.id===id&&b.kind==='farm'&&b.owner===u.owner&&b.built>=1&&!b.dead);return !!farm&&Math.hypot(farm.x-u.x,farm.y-u.y)<=33;}
export function gatheringOnKnees(g:LandGame,u:Unit){return extractingResource(g,u)||harvestingFood(g,u);}
export function stepGatherPose(g:LandGame,u:Unit,dt:number){const target=gatheringOnKnees(g,u)?1:0,current=u.kneel??0;u.kneel=target?Math.min(1,current+dt*4):Math.max(0,current-dt*7);}
