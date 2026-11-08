import type {CivId} from './landCivs';
import fruitsUrl from './assets/land/harvest-fruits.webp';
let fruits:HTMLImageElement|null=null;
export function harvestFruitsReady(){if(!fruits&&typeof Image!=='undefined'){fruits=new Image();fruits.src=fruitsUrl;}return !!fruits?.complete&&fruits.naturalWidth>0;}
export function drawFarm(ctx:CanvasRenderingContext2D,_civ:CivId,x:number,y:number,w:number,h:number){
  if(!harvestFruitsReady())return false;const image=fruits!,scale=Math.min(w/image.naturalWidth,h/image.naturalHeight),dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,x-dw/2,y-dh*.75,dw,dh);ctx.restore();return true;
}
export function drawStorehouse(ctx:CanvasRenderingContext2D,_civ:CivId,x:number,y:number,w:number,h:number){
  void _civ;ctx.save();ctx.translate(x,y);ctx.fillStyle='#123c29';ctx.strokeStyle='#a6cf81';ctx.lineWidth=1.5;ctx.fillRect(-w*.25,-h*.65,w*.5,h*.14);ctx.strokeRect(-w*.25,-h*.65,w*.5,h*.14);ctx.fillStyle='#e1efbd';ctx.font=`bold ${Math.max(7,w*.07)}px Arial`;ctx.textAlign='center';ctx.fillText('ALMACÉN',0,-h*.55);ctx.restore();return true;
}
