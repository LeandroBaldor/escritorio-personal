import {useEffect,useRef} from 'react';
import type {Cost,ResKind} from './land';
import {drawWorldProp} from './landProps';
import {drawFarm} from './landFarmArt';
export const RESOURCE_NAMES={stone:'Minerales azules',gem:'Minerales dorados',energy:'Minerales verdes',rock:'Piedras',food:'Alimentos'};
export const RESOURCE_ORDER:ResKind[]=['stone','gem','energy','rock'];
export function ResourceIcon({kind}:{kind:ResKind|'food'}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{let frame=0;const draw=()=>{const c=ref.current;if(!c)return;const ctx=c.getContext('2d')!;ctx.clearRect(0,0,64,64);const ready=kind==='food'?drawFarm(ctx,'humano',32,45,58,55):drawWorldProp(ctx,{stone:8,gem:9,energy:10,rock:4}[kind],32,59,54,59);if(!ready)frame=requestAnimationFrame(draw);};draw();return()=>cancelAnimationFrame(frame);},[kind]);
  return <canvas className="land-resource-icon" ref={ref} width={64} height={64} role="img" aria-label={RESOURCE_NAMES[kind]}/>;
}
export function LandCost({cost}:{cost:Cost}){return <span className="land-resource-cost" aria-label="Costo">{RESOURCE_ORDER.filter(k=>(cost[k]??0)>0).map(kind=><span key={kind} title={RESOURCE_NAMES[kind]} aria-label={`${cost[kind]} ${RESOURCE_NAMES[kind].toLowerCase()}`}><ResourceIcon kind={kind}/><b>{cost[kind]}</b></span>)}</span>;}
export const resourceCostText=(cost:Cost)=>RESOURCE_ORDER.filter(k=>(cost[k]??0)>0).map(k=>`${cost[k]} ${RESOURCE_NAMES[k].toLowerCase()}`).join(' · ');
