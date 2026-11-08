import type {Building} from './land';
export const isBuildingBurning=(b:Building)=>!b.dead&&b.built>=1&&b.hp>0&&b.hp<b.maxHp*.45&&b.lastHitBy!==undefined&&b.lastHitBy!==b.owner;
export function drawBuildingFire(ctx:CanvasRenderingContext2D,b:Building,w:number,h:number,time:number){
  if(!isBuildingBurning(b))return;
  const strength=1-b.hp/b.maxHp;
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(let i=0;i<7;i++){const phase=(time*.8+i*.17+b.id*.11)%1,x=b.x+Math.sin(i*7.3+b.id)*w*.32,y=b.y-h*(.12+(i%3)*.16)-phase*h*.28,r=(11+strength*16)*(1-phase*.65);const flame=ctx.createRadialGradient(x,y,0,x,y,r);flame.addColorStop(0,'#fff2a9');flame.addColorStop(.25,'#ffb62a');flame.addColorStop(.65,'#ec4c13aa');flame.addColorStop(1,'#be230000');ctx.fillStyle=flame;ctx.beginPath();ctx.ellipse(x,y,r*.65,r*1.5,Math.sin(time*4+i)*.16,0,Math.PI*2);ctx.fill();}
  ctx.globalCompositeOperation='source-over';for(let i=0;i<5;i++){const phase=(time*.23+i*.21)%1;ctx.fillStyle=`rgba(42,35,34,${.28*(1-phase)})`;ctx.beginPath();ctx.arc(b.x+Math.sin(i*3+phase*4)*w*.21,b.y-h*.65-phase*h*.5,7+phase*22,0,Math.PI*2);ctx.fill();}ctx.restore();
}
