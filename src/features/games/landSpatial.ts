import type {Unit} from './land';
// Índice temporal de un paso. Se actualiza al mover cada unidad para consultar posiciones actuales.
export class LandUnitIndex{
  private buckets=new Map<string,Set<Unit>>();
  private cells=new Map<number,string>();
  readonly byId=new Map<number,Unit>();
  constructor(units:Unit[]){for(const u of units)if(!u.dead){this.byId.set(u.id,u);this.move(u);}}
  private key(x:number,y:number){return `${Math.floor(x/320)}:${Math.floor(y/320)}`;}
  move(u:Unit){const key=this.key(u.x,u.y),old=this.cells.get(u.id);if(old===key)return;if(old)this.buckets.get(old)?.delete(u);const bucket=this.buckets.get(key)??new Set<Unit>();bucket.add(u);this.buckets.set(key,bucket);this.cells.set(u.id,key);}
  *near(x:number,y:number,r:number){for(let cy=Math.floor((y-r)/320);cy<=Math.floor((y+r)/320);cy++)for(let cx=Math.floor((x-r)/320);cx<=Math.floor((x+r)/320);cx++)for(const u of this.buckets.get(`${cx}:${cy}`)??[])if(!u.dead&&Math.hypot(u.x-x,u.y-y)<=r)yield u;}
}
