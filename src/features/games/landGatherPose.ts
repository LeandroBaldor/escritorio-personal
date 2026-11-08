import type {LandGame,Unit} from './land';
const KNEELING_CIVS=new Set(['humano','elfos','infernal','enanos','orcos']);
export function extractingResource(g:LandGame,u:Unit){if(u.dead||u.moving||u.order.k!=='gather'||u.carry>=8)return false;const id=u.order.node,node=g.nodes.find(n=>n.id===id&&n.amount>0);return !!node&&Math.hypot(node.x-u.x,node.y-u.y)<=28;}
export function gatheringOnKnees(g:LandGame,u:Unit){return KNEELING_CIVS.has(g.sides[u.owner].civ)&&extractingResource(g,u);}
export function stepGatherPose(g:LandGame,u:Unit,dt:number){const target=gatheringOnKnees(g,u)?1:0,current=u.kneel??0;u.kneel=target?Math.min(1,current+dt*4):Math.max(0,current-dt*7);}
