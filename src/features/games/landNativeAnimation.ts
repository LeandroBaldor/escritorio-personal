import type {CivId} from './landCivs';
import {animationFrame,type UnitAnimation} from './landAnimation';
type Sheet={image:HTMLImageElement;cw:number;ch:number;rows:{top:number;bottom:number;width:number}[]};
const URLS=import.meta.glob('./assets/land/animation-*.webp',{eager:true,import:'default'}) as Record<string,string>;
const sheets=new Map<string,Sheet>(),loading=new Set<string>();
function request(civ:CivId,kind:'collect'|'battle'){
  const key=`${kind}-${civ}`,old=sheets.get(key);if(old||loading.has(key))return old;
  const url=URLS[`./assets/land/animation-${key}.webp`];if(!url||typeof Image==='undefined')return undefined;
  loading.add(key);const image=new Image();image.onload=()=>{const rows=kind==='collect'?4:6,c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,cw=c.width/8,ch=c.height/rows,bounds=[];
    for(let row=0;row<rows;row++){let top=ch,bottom=0,left=cw,right=0;for(let col=0;col<8;col++)for(let y=Math.floor(row*ch);y<Math.floor((row+1)*ch);y++)for(let x=Math.floor(col*cw);x<Math.floor((col+1)*cw);x++)if(pixels[(y*c.width+x)*4+3]>64){top=Math.min(top,y-row*ch);bottom=Math.max(bottom,y-row*ch);left=Math.min(left,x-col*cw);right=Math.max(right,x-col*cw);}bounds.push({top,bottom,width:right-left+1});}
    sheets.set(key,{image,cw,ch,rows:bounds});};image.onerror=()=>loading.delete(key);image.src=url;return undefined;
}
export function preloadNativeAnimations(civs:readonly CivId[]){for(const civ of civs){request(civ,'collect');request(civ,'battle');}}
export function nativeAnimationsReady(civs:readonly CivId[]){preloadNativeAnimations(civs);return civs.every(c=>sheets.has(`collect-${c}`)&&sheets.has(`battle-${c}`));}
export function nativeFrame(civ:CivId,roleIndex:number,level:number,animation:UnitAnimation){
  const gathering=roleIndex===0&&(animation.action==='mine'||animation.action==='harvest'),battle=level===1&&(animation.action==='walk'||animation.action==='attack');if(!gathering&&!battle)return null;
  const sheet=request(civ,gathering?'collect':'battle');if(!sheet)return null;
  const row=gathering?Math.min(3,Math.max(0,level-1)):roleIndex,offset=animation.action==='harvest'||animation.action==='attack'?4:0,index=offset+animationFrame(animation.phase,4,animation.action!=='attack');return {sheet,row,index,gathering};
}
export function drawNativeAnimation(ctx:CanvasRenderingContext2D,civ:CivId,roleIndex:number,level:number,animation:UnitAnimation,h:number,maxW:number){const frame=nativeFrame(civ,roleIndex,level,animation);if(!frame)return false;const {sheet,row,index,gathering}=frame,b=sheet.rows[row],height=h*(gathering?.78:1),scale=Math.min(height/Math.max(1,b.bottom-b.top),maxW/Math.max(1,b.width));ctx.drawImage(sheet.image,index*sheet.cw,row*sheet.ch,sheet.cw,sheet.ch,-sheet.cw*scale/2,-b.bottom*scale,sheet.cw*scale,sheet.ch*scale);return true;}
