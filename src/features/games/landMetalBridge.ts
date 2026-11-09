import {T,LIQUID} from './landMap';
let plate:HTMLCanvasElement|null=null;const patterns=new WeakMap<CanvasRenderingContext2D,CanvasPattern>();
function steel(ctx:CanvasRenderingContext2D){
 const old=patterns.get(ctx);if(old)return old;
 if(!plate){plate=document.createElement('canvas');plate.width=plate.height=160;const p=plate.getContext('2d')!;p.fillStyle='#4d5d68';p.fillRect(0,0,160,160);let seed=7143;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967295;
  for(let i=0;i<1300;i++){const x=rand()*160,y=rand()*160;p.strokeStyle=i%2?'#dce7e91a':'#03121c30';p.lineWidth=.35+rand()*.4;p.beginPath();p.moveTo(x,y);p.lineTo(x+2+rand()*9,y+.3);p.stroke();}
  for(let y=3;y<160;y+=10)for(let x=3;x<160;x+=12){const px=x+(Math.floor(y/10)%2)*6;p.lineWidth=1.5;p.strokeStyle='#142633b0';p.beginPath();p.moveTo(px-2,y+2);p.lineTo(px+2,y-2);p.stroke();p.strokeStyle='#a4b6be99';p.beginPath();p.moveTo(px-2,y+1);p.lineTo(px+2,y-3);p.stroke();}
 }
 const pattern=ctx.createPattern(plate,'repeat')!;patterns.set(ctx,pattern);return pattern;
}
export function drawMetalBridge(ctx:CanvasRenderingContext2D,x:number,y:number,theme:number,edges:number[]){
 ctx.save();ctx.fillStyle='#08141bcc';ctx.fillRect(x-2,y+7,T+5,T+7);const side=ctx.createLinearGradient(0,y+T-2,0,y+T+10);side.addColorStop(0,'#75828a');side.addColorStop(.2,'#293d4c');side.addColorStop(1,'#0a1621');ctx.fillStyle=side;ctx.fillRect(x,y+T-2,T,10);
 ctx.fillStyle=steel(ctx);ctx.fillRect(x,y-1,T,T+2);const light=ctx.createLinearGradient(x,y,x+T,y+T);light.addColorStop(0,'#dbe9ee35');light.addColorStop(.4,'#dbe9ee08');light.addColorStop(1,'#05121d65');ctx.fillStyle=light;ctx.fillRect(x,y,T,T);
 ctx.strokeStyle='#142735';ctx.lineWidth=1;ctx.strokeRect(x+.6,y+.6,T-1.2,T-1.2);ctx.strokeStyle='#a5bdc44d';ctx.beginPath();ctx.moveTo(x+2,y+1.5);ctx.lineTo(x+T-2,y+1.5);ctx.stroke();
 for(const [dx,dy] of [[4,4],[T-4,4],[4,T-4],[T-4,T-4]]){ctx.fillStyle='#10202a';ctx.beginPath();ctx.arc(x+dx,y+dy,1.8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b5c5cb';ctx.beginPath();ctx.arc(x+dx-.4,y+dy-.5,.8,0,Math.PI*2);ctx.fill();}
 const rail=(x0:number,y0:number,x1:number,y1:number)=>{ctx.strokeStyle='#03121db0';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x0+2,y0+4);ctx.lineTo(x1+2,y1+4);ctx.stroke();ctx.strokeStyle='#263b4b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();ctx.strokeStyle='#c6d5d9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0,y0-1);ctx.lineTo(x1,y1-1);ctx.stroke();for(const k of [.12,.85]){const px=x0+(x1-x0)*k,py=y0+(y1-y0)*k;ctx.fillStyle='#1c303c';ctx.fillRect(px-1.5,py-6,3,9);ctx.fillStyle='#adbdc4';ctx.fillRect(px-1.5,py-6,1,7);}};
 if(edges[0]===LIQUID)rail(x,y-3,x+T,y-3);if(edges[1]===LIQUID)rail(x+T-1,y-2,x+T-1,y+T);if(edges[2]===LIQUID)rail(x,y+T,x+T,y+T);if(edges[3]===LIQUID)rail(x+1,y-2,x+1,y+T);
 if(theme===6){ctx.fillStyle='#f1faffb0';ctx.fillRect(x+2,y+1,T-4,2);}else if(theme===2||theme===7){ctx.fillStyle=theme===2?'#a6632830':'#64714235';ctx.fillRect(x+2,y+T-6,T-4,3);}ctx.restore();
}
