import {T,GROUND,LIQUID,THEMES,type Terrain} from './landMap';
import type {TerrainRegion} from './landMapArt';
// Paletas tomadas de las láminas de selección; se aplican al arte del mundo.
export const BIOME_PROPS=[
 {tree:'hue-rotate(155deg) saturate(.7)',rock:'sepia(.3) hue-rotate(245deg)'},
 {tree:'saturate(1.25)',rock:'sepia(.25)'},
 {tree:'grayscale(.85) brightness(.62)',rock:'grayscale(.9) brightness(.58)'},
 {tree:'saturate(.95)',rock:'saturate(.5)'},
 {tree:'saturate(.7)',rock:'sepia(.65) saturate(1.2)'},
 {tree:'sepia(.25) saturate(.8)',rock:'sepia(.9) saturate(1.15)'},
 {tree:'saturate(.2) brightness(1.55) hue-rotate(30deg)',rock:'saturate(.2) brightness(1.4)'},
 {tree:'sepia(.4) saturate(.65) brightness(.8)',rock:'sepia(.45) brightness(.8)'},
 {tree:'sepia(.95) saturate(3.5) hue-rotate(345deg) brightness(1.12)',rock:'sepia(.2)'},
 {tree:'hue-rotate(35deg) saturate(1.3)',rock:'hue-rotate(145deg) saturate(.65)'},
];
const rand=(x:number,y:number,seed:number)=>{let k=Math.imul(x+1,73856093)^Math.imul(y+1,19349663)^seed;k=Math.imul(k^(k>>>13),1274126177);return (k>>>0)/4294967295;};
export function drawBiomeGround(ctx:CanvasRenderingContext2D,t:Terrain,region?:TerrainRegion){
 const step=64,x0=Math.max(0,Math.floor((region?.x??0)/step)-1),y0=Math.max(0,Math.floor((region?.y??0)/step)-1),x1=Math.min(Math.ceil(t.w/step),Math.ceil(((region?.x??0)+(region?.w??t.w))/step)+1),y1=Math.min(Math.ceil(t.h/step),Math.ceil(((region?.y??0)+(region?.h??t.h))/step)+1);
 ctx.save();ctx.lineCap='round';
 for(let cy=y0;cy<y1;cy++)for(let cx=x0;cx<x1;cx++){
  const n=rand(cx,cy,t.seed),x=(cx+n)*step,y=(cy+rand(cy,cx,t.seed+3))*step,c=Math.floor(x/T),r=Math.floor(y/T);if(t.cells[r*t.cols+c]!==GROUND)continue;
  if(t.theme===5){ // Curvas de sotavento y crestas iluminadas de arena.
   for(let i=0;i<5;i++){ctx.strokeStyle=i%2?'#f4d59b66':'#8d612936';ctx.lineWidth=i===0?2: .7;ctx.beginPath();ctx.moveTo(x-29,y+i*4);ctx.bezierCurveTo(x-10,y-8+i*4,x+14,y+7+i*4,x+33,y-2+i*4);ctx.stroke();}
  }else if(t.theme===6){
   const g=ctx.createRadialGradient(x-8,y-6,1,x,y,29);g.addColorStop(0,'#ffffffa0');g.addColorStop(.6,'#e5f1fa60');g.addColorStop(1,'#9cbad100');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,34,13,-.3,0,Math.PI*2);ctx.fill();if(n>.78){ctx.strokeStyle='#799ebd77';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x-15,y+3);ctx.lineTo(x-3,y-4);ctx.lineTo(x+2,y+5);ctx.lineTo(x+15,y-5);ctx.stroke();}
  }else if(t.theme===0||t.theme===2){
   ctx.strokeStyle=t.theme===2?'#171417b0':'#241a30a0';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(x-25,y-4);ctx.lineTo(x-9,y+6);ctx.lineTo(x+4,y-3);ctx.lineTo(x+25,y+7);ctx.moveTo(x-9,y+6);ctx.lineTo(x-12,y+20);ctx.stroke();
   if(n>.65){ctx.strokeStyle=t.theme===2?'#ff7f254f':'#8ed24545';ctx.lineWidth=.7;ctx.stroke();}
  }else if(t.theme===7){
   const g=ctx.createRadialGradient(x,y,2,x,y,30);g.addColorStop(0,'#32291990');g.addColorStop(1,'#272c1800');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,34,17,.25,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b2ba7c38';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y-3,18,5,-.2,Math.PI,Math.PI*1.8);ctx.stroke();
  }else if(t.theme===9){
   ctx.strokeStyle='#abe9df30';ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(x-24,y+i*6);ctx.quadraticCurveTo(x,y-10+i*6,x+24,y+i*6);ctx.stroke();}
  }else if(t.theme===4){
   ctx.strokeStyle='#e1c09a50';ctx.lineWidth=1.2;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(x-16,y+i*3);ctx.lineTo(x+15,y-4+i*3);ctx.stroke();}
  }else { // Musgo, pétalos y hojarasca en tres paletas distintas.
   for(let i=0;i<4;i++){const px=x+(rand(cx+i,cy,t.seed+9)-.5)*36,py=y+i*3;ctx.fillStyle=t.theme===8?['#c77a3280','#dcaa4380','#8d482850'][i%3]:t.theme===1?'#d7ef8b55':'#b8cc8250';ctx.beginPath();ctx.ellipse(px,py,2+n*3,1.2,n*5,0,Math.PI*2);ctx.fill();}
  }
 }
 ctx.restore();
}
export function drawBiomeLiquid(ctx:CanvasRenderingContext2D,t:Terrain,region?:TerrainRegion){
 ctx.save();const th=THEMES[t.theme];
 for(let r=0;r<t.rows;r++)for(let c=0;c<t.cols;c++){
  if(t.cells[r*t.cols+c]!==LIQUID)continue;const x=(c+.5)*T,y=(r+.5)*T;if(region&&(x<region.x-T||x>region.x+region.w+T||y<region.y-T||y>region.y+region.h+T))continue;
  const n=rand(c,r,t.seed);if(t.theme===2&&n>.5){
   // Costra basáltica flotante; el magma queda visible entre sus placas.
   const px=x+(rand(c,r,t.seed+4)-.5)*19,py=y+(n-.5)*23,g=ctx.createLinearGradient(px-12,py-10,px+14,py+10);g.addColorStop(0,'#4a3b32');g.addColorStop(.5,'#211c19');g.addColorStop(1,'#140f0e');ctx.fillStyle=g;ctx.strokeStyle='#ffac3288';ctx.lineWidth=.7;ctx.beginPath();for(let i=0;i<7;i++){const a=i/7*Math.PI*2,rad=(5+rand(c+i,r,t.seed)*16)*(n+.3),xx=px+Math.cos(a)*rad,yy=py+Math.sin(a)*rad*.7;if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);}ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#7d55474f';ctx.beginPath();ctx.moveTo(px-5,py-3);ctx.lineTo(px+2,py+2);ctx.lineTo(px+7,py-1);ctx.stroke();
  }else if(t.theme===0&&n>.55){ctx.strokeStyle='#c8ff6677';ctx.lineWidth=.8;for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(x-10+i*8,y+(i%2)*6,2+i,1+i*.5,0,0,Math.PI*2);ctx.stroke();}
  }else if(t.theme===6&&n>.63){ctx.fillStyle='#c7eff2b0';ctx.strokeStyle='#f4ffffd0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-12,y);ctx.lineTo(x-3,y-8);ctx.lineTo(x+13,y-4);ctx.lineTo(x+7,y+5);ctx.closePath();ctx.fill();ctx.stroke();
  }else if(t.theme===7&&n>.6){ctx.fillStyle='#6b87366b';ctx.beginPath();ctx.ellipse(x,y,9+n*5,4,.3,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a9ba6945';ctx.stroke();
  }else if(!th.glow&&n>.72){ctx.strokeStyle=th.liquid[0]+'66';ctx.lineWidth=.7;ctx.beginPath();ctx.ellipse(x,y,11,3,-.15,0,Math.PI);ctx.stroke();}
 }
 ctx.restore();
}
