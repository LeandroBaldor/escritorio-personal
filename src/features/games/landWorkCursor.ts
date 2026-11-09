import type {LandGame,Unit} from './land';
export const landResourceAt=(g:LandGame,x:number,y:number)=>g.nodes.find(n=>n.amount>0&&(Math.hypot(n.x-x,n.y-y)<34||((n.x-x)/38)**2+((n.y-27-y)/48)**2<1));
export function landWorkCursor(g:LandGame,units:Unit[],x:number,y:number):'mine'|'harvest'|''{
 const worker=units.find(u=>u.role==='worker'&&!u.dead);if(!worker)return '';
 if(g.buildings.some(b=>b.owner===worker.owner&&!b.dead&&b.built>=1&&b.kind==='farm'&&Math.hypot(b.x-x,b.y-y)<65))return 'harvest';
 return landResourceAt(g,x,y)?'mine':'';
}
