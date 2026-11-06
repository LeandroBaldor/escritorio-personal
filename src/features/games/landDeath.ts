import { CIVS, type CivId } from './landCivs';
import type { Role, Unit } from './land';

export function deathStyle(civ: CivId, role: Role) {
  const fire = civ === 'mecanico' || ((civ === 'humano' || civ === 'enanos') && (role === 'heavy' || role === 'elite'));
  return { fire, color: civ === 'humano' || civ === 'elfos' ? '#4de35b' : CIVS[civ].color };
}
export function drawDeath(ctx: CanvasRenderingContext2D, civ: CivId, u: Unit, size: number) {
  const age = u.dead, { fire, color } = deathStyle(civ, u.role), fade = Math.max(0, 1 - age / 2.4), scale = size / 90;
  ctx.save(); ctx.translate(u.x, u.y); ctx.scale(scale, scale);
  if (!fire) {
    ctx.globalAlpha = fade * .65; ctx.fillStyle = color;
    for (let i = 0; i < 13; i++) { const a = i * 2.399 + u.id, r = 6 + i * 2.8; ctx.beginPath(); ctx.ellipse(Math.cos(a)*r,Math.sin(a)*r*.4,7+i%5,3+i%3,a,0,Math.PI*2); ctx.fill(); }
  }
  for (let i = 0; i < 34; i++) {
    const seed = Math.sin(u.id * 17 + i * 91.7) * 43758.5, rand = seed - Math.floor(seed), a = i * 2.399 + u.id;
    const flight = Math.min(age, .65 + rand*.3), speed = 45 + rand*125;
    const x = Math.cos(a)*speed*flight, y = -38 + Math.sin(a)*speed*flight*.5 - (50+rand*95)*flight + 160*flight*flight;
    ctx.globalAlpha = fade * (fire ? Math.max(0, 1-age/(.7+rand)) : .95);
    if (fire) {
      ctx.globalCompositeOperation = 'lighter'; const radius = Math.max(1,(14+rand*17)*(1-Math.min(1,age/1.2)));
      const g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,'#fff6bc');g.addColorStop(.3,'#ffb325');g.addColorStop(.7,'#f34d14');g.addColorStop(1,'#a3190000');ctx.fillStyle=g;
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    } else {
      ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,2+rand*4,1.5+rand*2,a,0,Math.PI*2);ctx.fill();
    }
  }
  if(fire){ctx.globalCompositeOperation='source-over';for(let i=0;i<7;i++){ctx.globalAlpha=fade*.28;ctx.fillStyle='#34313a';ctx.beginPath();ctx.arc(Math.sin(i*2+u.id)*age*20,-35-age*38+i*3,8+age*12,0,Math.PI*2);ctx.fill();}}
  ctx.restore();
}
