import {CIVS,type CivId} from './landCivs';
export function drawFarm(ctx:CanvasRenderingContext2D,civ:CivId,x:number,y:number,w:number,h:number){
  ctx.save();ctx.translate(x,y);const soil=ctx.createLinearGradient(0,-h,0,0);soil.addColorStop(0,'#102c20');soil.addColorStop(1,'#183e27');ctx.fillStyle=soil;ctx.strokeStyle='#65864c';ctx.lineWidth=2;ctx.fillRect(-w/2,-h,w,h);ctx.strokeRect(-w/2,-h,w,h);
  const colors:Record<CivId,string>={humano:'#aaa65d',elfos:'#6fbc74',enanos:'#b48f70',orcos:'#8caa53',sauriano:'#ae7551',zergano:'#8b609b',nomuerta:'#8b87ae',infernal:'#d57e37',mecanico:'#75a282',abisal:'#5fa1a5'};
  for(let i=0;i<160;i++){const px=((i*73)%157)/157,py=((i*37)%149)/149;ctx.fillStyle=i%3?'#2c472b':'#39513a';ctx.globalAlpha=.5;ctx.fillRect(-w*.48+px*w*.96,-h*.96+py*h*.92,1.3,.8);}ctx.globalAlpha=1;
  for(let row=0;row<5;row++){const yy=-h+(row+.9)*h/5;ctx.strokeStyle='#0a2016';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-w*.46,yy+4);ctx.lineTo(w*.46,yy+4);ctx.stroke();for(let col=0;col<7;col++){const xx=-w*.42+col*w*.14;ctx.fillStyle='#071c13';ctx.beginPath();ctx.ellipse(xx+1,yy+2,5,2,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#65904d';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(xx,yy+2);ctx.lineTo(xx-.4,yy-6);ctx.stroke();
    for(const dir of [-1,1]){ctx.fillStyle=dir<0?'#315e35':'#527544';ctx.beginPath();ctx.moveTo(xx,yy);ctx.quadraticCurveTo(xx+dir*6,yy-6,xx+dir*5,yy-1);ctx.quadraticCurveTo(xx+dir*3,yy+2,xx,yy);ctx.fill();}
    ctx.fillStyle=colors[civ];ctx.beginPath();ctx.ellipse(xx-.4,yy-5,1.6,civ==='enanos'||civ==='nomuerta'?1.4:2.3,-.2,0,Math.PI*2);ctx.fill();}}
  ctx.fillStyle=CIVS[civ].color;ctx.fillRect(w*.43,-h-9,4,12);ctx.restore();return true;
}
export function drawStorehouse(ctx:CanvasRenderingContext2D,_civ:CivId,x:number,y:number,w:number,h:number){
  void _civ;ctx.save();ctx.translate(x,y);ctx.fillStyle='#123c29';ctx.strokeStyle='#a6cf81';ctx.lineWidth=1.5;ctx.fillRect(-w*.25,-h*.65,w*.5,h*.14);ctx.strokeRect(-w*.25,-h*.65,w*.5,h*.14);ctx.fillStyle='#e1efbd';ctx.font=`bold ${Math.max(7,w*.07)}px Arial`;ctx.textAlign='center';ctx.fillText('ALMACÉN',0,-h*.55);ctx.restore();return true;
}
