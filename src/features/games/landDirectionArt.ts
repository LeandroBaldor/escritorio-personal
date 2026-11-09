import atlasUrl from './assets/land/directions-back.webp';
import {CIV_IDS,type CivId} from './landCivs';
import {drawRig} from './landRig';
import {motionKind,stopMotionPhase} from './landMotion';
import type {UnitAnimation} from './landAnimation';
type Frame={sx:number;sy:number;sw:number;sh:number};
let image:HTMLImageElement|undefined,ready=false;
const frames:Frame[]=[];
export function directionalSpritesReady(){
 if(!image&&typeof Image!=='undefined'){image=new Image();image.onload=()=>{const c=document.createElement('canvas');c.width=image!.width;c.height=image!.height;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image!,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;
  for(let row=0;row<6;row++)for(let col=0;col<10;col++){const x0=Math.round(col*c.width/10),x1=Math.round((col+1)*c.width/10),y0=Math.round(row*c.height/6),y1=Math.round((row+1)*c.height/6);let left=x1,right=x0,top=y1,bottom=y0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pixels[(y*c.width+x)*4+3]>100){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}frames.push({sx:left,sy:top,sw:Math.max(1,right-left+1),sh:Math.max(1,bottom-top+1)});}ready=true;};image.src=atlasUrl;}
 return ready;
}
export function drawBackDirection(ctx:CanvasRenderingContext2D,civ:CivId,role:number,level:number,animation:UnitAnimation,h:number,maxW:number){
 if(!directionalSpritesReady()||!image)return false;
 const frame=frames[role*10+CIV_IDS.indexOf(civ)],k=Math.min(h/frame.sh,maxW/frame.sw),kind=civ==='zergano'&&role===0?'larva':motionKind(civ,role),phase=animation.action==='walk'?stopMotionPhase(animation.phase*Math.PI*2):0;
 ctx.save();if(level>1)ctx.filter=`saturate(${1+(level-1)*.18}) brightness(${1+(level-1)*.06})`;
 drawRig(ctx,image,frame,`back:${civ}:${role}:${level}`,frame.sw*k,frame.sh*k,phase,0,0,0,undefined,kind);
 ctx.restore();return true;
}
