import {CIV_IDS,type CivId} from './landCivs';
const sources=import.meta.glob('./assets/land/fortresses/*.png',{eager:true,import:'default'}) as Record<string,string>;
const images=new Map<string,HTMLImageElement>();
export function fortressesReady(){
 if(typeof Image==='undefined')return false;
 for(const civ of CIV_IDS)for(const kind of ['castle','energyTower']){const key=`${kind}-${civ}`;if(images.has(key))continue;const image=new Image();image.src=sources[`./assets/land/fortresses/${key}.png`];images.set(key,image);}
 return [...images.values()].every(image=>image.complete&&image.naturalWidth>0);
}
export function drawFortress(ctx:CanvasRenderingContext2D,civ:CivId,kind:'castle'|'energyTower',x:number,y:number,h:number,maxW:number){
 fortressesReady();const image=images.get(`${kind}-${civ}`);if(!image?.complete||!image.naturalWidth)return false;
 const scale=Math.min(h/image.naturalHeight,maxW/image.naturalWidth),w=image.naturalWidth*scale,dh=image.naturalHeight*scale;ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,x-w/2,y-dh,w,dh);ctx.restore();return true;
}
