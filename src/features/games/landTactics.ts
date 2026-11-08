import type {LandGame,Unit} from './land';
export const BASE_CAMERA_ZOOM=1.6/1.2;
export const MIN_CAMERA_ZOOM=(1.6/1.1)/1.2;
export const MAX_CAMERA_ZOOM=2.8;
export const UNIT_TRAINING_SECONDS=60;
export const formationSpacing=(size:number)=>Math.max(64,size*1.1+10);
export const bodyRadius=(size:number)=>size*.5;
export const resourceReach=(size:number)=>bodyRadius(size)*1.4+22;
export function selectedInBox(g:LandGame,a:{x:number;y:number},b:{x:number;y:number},size:(u:Unit)=>number){
 const inside=g.units.filter(u=>u.owner===0&&!u.dead&&u.x>=a.x&&u.x<=b.x&&u.y>=a.y&&u.y-size(u)*.5<=b.y);
 const soldiers=inside.filter(u=>u.role!=='worker');return (soldiers.length?soldiers:inside).map(u=>u.id);
}
export function pairDirection(a:Unit,b:Unit){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>.01)return {d,nx:dx/d,ny:dy/d};const angle=((a.id*73856093^b.id*19349663)>>>0)%360*Math.PI/180;return {d:0,nx:Math.cos(angle),ny:Math.sin(angle)};}
