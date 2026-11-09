import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {LandGame} from '../src/features/games/land';
const name=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name;
const base=process.env.LAND_BASE??(name==='minijuegos'?'/MiniJuegos/':'/escritorio-personal/');
interface SoundWindow extends Window {__landGame:()=>LandGame;__landClips:{offset:number;duration:number}[];__landStops:number}
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    const w=window as SoundWindow;w.__landClips=[];w.__landStops=0;
    const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start=function(when=0,offset=0,duration?:number){if(duration!==undefined)w.__landClips.push({offset,duration});start.call(this,when,offset,duration);};
    AudioBufferSourceNode.prototype.stop=function(when?:number){if(when===undefined)w.__landStops++;stop.call(this,when);};
  });
});
async function openGame(page:import('@playwright/test').Page,civ:string){
  await page.goto(base+'#/juegos');await page.getByRole('link',{name:/Land of Warriors/}).click();await page.getByRole('button',{name:/Iniciar/}).click();
  await page.getByRole('button',{name:civ,exact:true}).click();await page.getByRole('button',{name:/Continuar/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await expect(page.getByTestId('land-energy')).toBeVisible({timeout:30000});
}
test('humanos: pasos recortados al caminar y silencio al quedar quietos',async({page})=>{
  test.setTimeout(60000);await openGame(page,'Imperio Humano');
  await page.getByRole('button',{name:'Un trabajador sin hacer nada',exact:true}).click();
  await page.evaluate(async base=>{
    const {orderMove}=await import(base+'src/features/games/land.ts'),{T,GROUND}=await import(base+'src/features/games/landMap.ts');
    const g=(window as SoundWindow).__landGame(),u=g.units.find(u=>u.owner===0)!;g.ai.t=Infinity;
    for(let y=Math.floor((u.y-100)/T);y<=Math.floor((u.y+100)/T);y++)for(let x=Math.floor((u.x-100)/T);x<=Math.floor((u.x+1100)/T);x++)if(x>=0&&y>=0&&x<g.terrain.cols&&y<g.terrain.rows)g.terrain.cells[y*g.terrain.cols+x]=GROUND;
    orderMove(g,[u.id],u.x+1000,u.y);
  },base);
  const steps=()=>page.evaluate(()=>(window as SoundWindow).__landClips.filter(c=>c.duration<=.23).length);
  await expect.poll(steps,{timeout:15000}).toBeGreaterThan(0);
  await page.evaluate(()=>{for(const u of (window as SoundWindow).__landGame().units)if(u.owner===0)u.order={k:'idle'};});
  await page.waitForTimeout(300);const count=await steps();await page.waitForTimeout(600);expect(await steps()).toBe(count);
});
test('elfos: frase melódica con recorte y se detiene al pausar',async({page})=>{
  test.setTimeout(60000);await openGame(page,'Elfos de Yldran');await page.getByRole('button',{name:'Un trabajador sin hacer nada',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as SoundWindow).__landClips.some(c=>c.duration>=.6&&c.duration<=1.7)),{timeout:15000}).toBe(true);
  const before=await page.evaluate(()=>(window as SoundWindow).__landStops);await page.keyboard.press('p');await expect(page.getByRole('heading',{name:'Pausa',exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as SoundWindow).__landStops)).toBeGreaterThan(before);
  const count=await page.evaluate(()=>(window as SoundWindow).__landClips.length);await page.waitForTimeout(700);expect(await page.evaluate(()=>(window as SoundWindow).__landClips.length)).toBe(count);
});
