import {CIV_IDS,type CivId} from './landCivs';
type Frame={sx:number;sy:number;sw:number;sh:number};
const URLS=import.meta.glob('./assets/land/evolutions-*.webp',{eager:true,import:'default'}) as Record<string,string>;
const sheets:Partial<Record<CivId,{image:HTMLCanvasElement;frames:Frame[]}>>={};
let started=false;
export function evolutionsReady(){
  if(!started&&typeof Image!=='undefined'){
    started=true;for(const civ of CIV_IDS){const image=new Image();image.onload=()=>{
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const c=canvas.getContext('2d',{willReadFrequently:true})!;c.drawImage(image,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data,frames:Frame[]=[];
      for(let row=0;row<6;row++)for(let col=0;col<4;col++){
        const x0=Math.round(col*canvas.width/4),x1=Math.round((col+1)*canvas.width/4),y0=Math.round(row*canvas.height/6),y1=Math.round((row+1)*canvas.height/6);let left=x1,right=x0,top=y1,bottom=y0;
        for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pixels[(y*canvas.width+x)*4+3]>64){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
        frames.push(right>=left?{sx:left,sy:top,sw:right-left+1,sh:bottom-top+1}:{sx:x0,sy:y0,sw:x1-x0,sh:y1-y0});
      }sheets[civ]={image:canvas,frames};
    };image.src=URLS[`./assets/land/evolutions-${civ}.webp`];}
  }return CIV_IDS.every(civ=>!!sheets[civ]);
}
export function evolvedSprite(civ:CivId,roleIndex:number,level:number){evolutionsReady();const sheet=sheets[civ];return sheet?{image:sheet.image,frame:sheet.frames[roleIndex*4+Math.min(4,Math.max(1,level))-1]}:null;}
