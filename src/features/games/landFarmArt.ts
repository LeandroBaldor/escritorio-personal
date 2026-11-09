import type {CivId} from './landCivs';
import fruitsUrl from './assets/land/harvest-fruits.webp';
let fruits:HTMLImageElement|null=null;
export function harvestFruitsReady(){if(!fruits&&typeof Image!=='undefined'){fruits=new Image();fruits.src=fruitsUrl;}return !!fruits?.complete&&fruits.naturalWidth>0;}
export function drawFarm(ctx:CanvasRenderingContext2D,_civ:CivId,x:number,y:number,w:number,h:number){
  if(!harvestFruitsReady())return false;const image=fruits!,scale=Math.min(w/image.naturalWidth,h/image.naturalHeight),dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,x-dw/2,y-dh*.75,dw,dh);ctx.restore();return true;
}
