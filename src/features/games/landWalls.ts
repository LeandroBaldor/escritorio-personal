import { BLOCK, T, type Terrain } from './landMap';
import type { LandGame } from './land';
import { CIVS, type CivId } from './landCivs';

const ATLAS = Object.values(import.meta.glob('./assets/land/walls.webp',{eager:true,import:'default'}))[0] as string | undefined;
let image: HTMLImageElement | null = null;
const frames: {x:number;y:number;w:number;h:number}[]=[];
const civOrder: CivId[]=['humano','zergano','elfos','enanos','nomuerta','sauriano','infernal','mecanico','orcos','abisal'];
export function wallsReady() {
  if(!image && ATLAS && typeof Image !== 'undefined'){
    image=new Image();image.onload=()=>{
      const cv=document.createElement('canvas');cv.width=image!.naturalWidth;cv.height=image!.naturalHeight;
      const ctx=cv.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image!,0,0);const p=ctx.getImageData(0,0,cv.width,cv.height).data;
      for(let i=0;i<10;i++){
        const x0=Math.round(i%2*cv.width/2),x1=Math.round((i%2+1)*cv.width/2),y0=Math.round(Math.floor(i/2)*cv.height/5),y1=Math.round((Math.floor(i/2)+1)*cv.height/5);
        let left=x1,right=x0,top=y1,bottom=y0;
        for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(p[(y*cv.width+x)*4+3]>40){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
        frames.push({x:left,y:top,w:Math.max(1,right-left+1),h:Math.max(1,bottom-top+1)});
      }
    };image.src=ATLAS;
  }
  return frames.length===10;
}

export const WALL_SIZE = 80;
export const wallPoint = (x: number, y: number) => ({ x: Math.floor(x / WALL_SIZE) * WALL_SIZE + WALL_SIZE / 2, y: Math.floor(y / WALL_SIZE) * WALL_SIZE + WALL_SIZE / 2 });
export function wallAcross(g: LandGame, from: {x:number;y:number;owner:number}, to: {x:number;y:number}) {
  const dx=to.x-from.x,dy=to.y-from.y;
  return g.buildings.filter(b=>b.kind==='wall'&&b.built>=1&&!b.dead&&b.owner!==from.owner).map(b=>{
    let enter=0,exit=1;
    for(const [start,d,center] of [[from.x,dx,b.x],[from.y,dy,b.y]]) {
      if(Math.abs(d)<.001){if(Math.abs(start-center)>WALL_SIZE/2)return {b,t:Infinity};}
      else {const a=(center-WALL_SIZE/2-start)/d,z=(center+WALL_SIZE/2-start)/d;enter=Math.max(enter,Math.min(a,z));exit=Math.min(exit,Math.max(a,z));}
    }
    return {b,t:enter<=exit?enter:Infinity};
  }).filter(q=>q.t<1).sort((a,b)=>a.t-b.t)[0]?.b;
}
const cache = new WeakMap<LandGame, { key: string; terrain: Terrain }>();
// La geografía visual se conserva; solo el mapa de navegación recibe obstáculos.
export function wallNavigation(g: LandGame): Terrain {
  const walls = g.buildings.filter(b => b.kind === 'wall' && b.built >= 1 && !b.dead);
  if (!walls.length) return g.terrain;
  const key = walls.map(b => b.id).join(','), old = cache.get(g); if (old?.key === key) return old.terrain;
  const terrain = { ...g.terrain, cells: g.terrain.cells.slice() };
  for (const b of walls) for (let r = Math.floor((b.y - WALL_SIZE / 2) / T); r < Math.ceil((b.y + WALL_SIZE / 2) / T); r++) for (let c = Math.floor((b.x - WALL_SIZE / 2) / T); c < Math.ceil((b.x + WALL_SIZE / 2) / T); c++) {
    if (r >= 0 && c >= 0 && r < terrain.rows && c < terrain.cols) terrain.cells[r * terrain.cols + c] = BLOCK;
  }
  cache.set(g, { key, terrain }); return terrain;
}
export function drawWall(ctx: CanvasRenderingContext2D, civ: CivId, x: number, y: number, width = 80, height = 65) {
  if(wallsReady()){
    const f=frames[civOrder.indexOf(civ)],k=Math.min(width/f.w,height/f.h);
    ctx.drawImage(image!,f.x,f.y,f.w,f.h,x-f.w*k/2,y-f.h*k,f.w*k,f.h*k);return true;
  }
  const palette: Record<CivId, [string, string, string]> = {
    humano: ['#7894ad', '#253b52', '#bdc8cd'], mecanico: ['#979d94', '#343a37', '#ddd2a4'], enanos: ['#8b7762', '#3b3431', '#c2ad86'],
    elfos: ['#728566', '#283f31', '#b2c587'], orcos: ['#805e38', '#382a23', '#bd9659'], zergano: ['#79517f', '#35243e', '#b98fbd'],
    nomuerta: ['#777078', '#302c39', '#b3a7b6'], sauriano: ['#817c5b', '#383b29', '#bbb38a'], infernal: ['#76605a', '#342728', '#b38a70'], abisal: ['#507a7c', '#203f48', '#8db9b4'],
  };
  const [face, side, top] = palette[civ], tech = civ === 'humano' || civ === 'mecanico', organic = civ === 'zergano' || civ === 'abisal';
  ctx.save(); ctx.translate(x, y); ctx.scale(width / 80, height / 65);
  const poly = (points: number[][], fill: string) => { ctx.fillStyle = fill; ctx.beginPath(); points.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#101a20'; ctx.lineWidth = 1; ctx.stroke(); };
  ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(6, 4, 47, 17, 0, 0, Math.PI * 2); ctx.fill();
  poly([[-40,-13],[25,-2],[25,-47],[-40,-58]],face);
  poly([[25,-2],[40,-13],[40,-58],[25,-47]],side);
  poly([[-40,-58],[25,-47],[40,-58],[-25,-69]],top);
  ctx.strokeStyle = side; ctx.lineWidth = 2;
  for (let row = 1; row <= 2; row++) { ctx.beginPath(); ctx.moveTo(-40,-58+row*15); ctx.lineTo(25,-47+row*15); ctx.stroke(); }
  for (let i = 0; i < 4; i++) {
    const xx = -34 + i * 19, yy = -57 + (xx+40)*.17;
    if (tech) { poly([[xx,yy],[xx+8,yy+1],[xx+8,yy+34],[xx,yy+33]],side); ctx.fillStyle = CIVS[civ].color; ctx.fillRect(xx+2,yy+11,4,13); }
    else if (organic) { ctx.fillStyle = CIVS[civ].color; ctx.beginPath(); ctx.ellipse(xx,yy+17,5,12,-.3,0,Math.PI*2); ctx.fill(); }
    else { poly([[xx,yy],[xx+9,yy+2],[xx+9,yy-10],[xx,yy-12]],top); }
    if (civ === 'orcos' || civ === 'sauriano' || civ === 'zergano' || civ === 'infernal') poly([[xx-3,yy],[xx+5,yy],[xx+1,yy-19]],top);
  }
  ctx.strokeStyle = CIVS[civ].color; ctx.lineWidth = organic ? 3 : 2; ctx.globalAlpha = .7;
  ctx.beginPath(); ctx.moveTo(-38,-22); ctx.lineTo(23,-11); ctx.stroke();
  ctx.restore();
  return false;
}
