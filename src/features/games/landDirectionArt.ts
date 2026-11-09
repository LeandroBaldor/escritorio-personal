import {CIV_IDS,type CivId} from './landCivs';
import {levelIndex} from './landBalance';
import {drawRig} from './landRig';
import {motionKind,stopMotionPhase} from './landMotion';
import type {UnitAnimation} from './landAnimation';
import {spriteBounds} from './landSpriteBounds';
type Frame={sx:number;sy:number;sw:number;sh:number};
type Sheet={image:HTMLCanvasElement;frames:Frame[]};
const urls=import.meta.glob('./assets/land/directions-levels-*.webp',{eager:true,import:'default'}) as Record<string,string>;
const sheets=new Map<CivId,Sheet>(),loading=new Set<CivId>();
export function directionalSpritesReady(){
 for(const civ of CIV_IDS){if(loading.has(civ)||sheets.has(civ))continue;const url=urls[`./assets/land/directions-levels-${civ}.webp`];if(!url||typeof Image==='undefined')continue;loading.add(civ);const image=new Image();image.onload=()=>{
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,frames:Frame[]=[];
  for(let row=0;row<6;row++)for(let col=0;col<8;col++)frames.push(spriteBounds(pixels,canvas.width,Math.round(col*canvas.width/8),Math.round(row*canvas.height/6),Math.round((col+1)*canvas.width/8),Math.round((row+1)*canvas.height/6)));
  sheets.set(civ,{image:canvas,frames});
 };image.onerror=()=>loading.delete(civ);image.src=url;}
 return CIV_IDS.every(civ=>sheets.has(civ));
}
export function directionalFrame(civ:CivId,role:number,level:number,facing:'front'|'back'){
 directionalSpritesReady();const sheet=sheets.get(civ);if(!sheet)return null;
 const start=role*8+(levelIndex(level)-1)*2,front=sheet.frames[start],back=sheet.frames[start+1];
 const referenceHeight=Math.max(front.sh,back.sh),aspectRatio=Math.max(front.sw/front.sh,back.sw/back.sh);
 return {image:sheet.image,frame:facing==='back'?back:front,referenceHeight,referenceWidth:aspectRatio*referenceHeight};
}
export function drawDirectionalUnit(ctx:CanvasRenderingContext2D,civ:CivId,role:number,level:number,animation:UnitAnimation,h:number,maxW:number){
 if(animation.facing!=='front'&&animation.facing!=='back')return false;
 const sprite=directionalFrame(civ,role,level,animation.facing);if(!sprite)return false;
 const {image,frame,referenceHeight,referenceWidth}=sprite,height=Math.min(h,maxW*referenceHeight/referenceWidth),k=height/frame.sh,kind=civ==='zergano'&&role===0?'larva':motionKind(civ,role),phase=animation.action==='walk'?stopMotionPhase(animation.phase*Math.PI*2):0;
 if(animation.action==='walk')drawRig(ctx,image,frame,`direction:${civ}:${role}:${level}:${animation.facing}`,frame.sw*k,frame.sh*k,phase,0,0,0,undefined,kind);
 else ctx.drawImage(image,frame.sx,frame.sy,frame.sw,frame.sh,-frame.sw*k/2,-frame.sh*k,frame.sw*k,frame.sh*k);
 return true;
}
