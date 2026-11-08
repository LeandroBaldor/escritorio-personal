import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {LandGame} from '../src/features/games/land';
const name=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name;
const base=process.env.LAND_BASE??(name==='minijuegos'?'/MiniJuegos/':'/escritorio-personal/');
interface Debug extends Window{__landGame:()=>LandGame;__audios:HTMLAudioElement[];__digClips:number}
test('Land 15: música en bucle, mute independiente y excavación visible',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const w=window as Debug;w.__audios=[];w.__digClips=0;const NativeAudio=window.Audio;window.Audio=class extends NativeAudio{constructor(src?:string){super(src);w.__audios.push(this);}};const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(when=0,offset=0,duration?:number){if(duration!==undefined&&Math.abs(duration-.28)<.001)w.__digClips++;start.call(this,when,offset,duration);};});
  await page.goto(base+'#/juegos');await page.getByRole('link',{name:/Land of Warriors/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await page.getByRole('button',{name:/Continuar/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await expect(page.getByTestId('land-energy')).toBeVisible({timeout:30000});
  await expect.poll(()=>page.evaluate(()=>(window as Debug).__audios.some(a=>a.src.includes('music-game')&&!a.paused&&a.loop))).toBe(true);
  await page.getByRole('button',{name:'Silenciar música de la partida',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as Debug).__audios.filter(a=>a.src.includes('music-game')).every(a=>a.paused&&a.muted))).toBe(true);
  await page.getByRole('button',{name:'Un trabajador sin hacer nada',exact:true}).click();await page.evaluate(()=>{const g=(window as Debug).__landGame(),u=g.units.find(u=>u.owner===0)!;g.units=[u];g.ais.forEach(a=>a.t=Infinity);const c=(window as Debug & {__landCam:()=>{x:number;y:number;w:number;z:number}}).__landCam();u.x=c.x+c.w*.65/c.z;u.y=c.y+180/c.z;g.nodes=[{id:9999,kind:'stone',x:u.x+20,y:u.y,amount:100}];u.order={k:'gather',node:9999};});
  await expect.poll(()=>page.evaluate(()=>(window as Debug).__digClips),{timeout:15000}).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Activar música de la partida',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as Debug).__audios.some(a=>a.src.includes('music-game')&&!a.paused&&!a.muted))).toBe(true);
  await page.evaluate(()=>{const a=(window as Debug).__audios.find(a=>a.src.includes('music-game'))!;a.dispatchEvent(new Event('ended'));});await expect.poll(()=>page.evaluate(()=>(window as Debug).__audios.find(a=>a.src.includes('music-game'))!.currentTime)).toBeLessThan(3);
  await page.getByRole('button',{name:'Pausa',exact:true}).click();await expect(page.getByRole('heading',{name:'Pausa',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as Debug).__audios.filter(a=>a.src.includes('music-game')).every(a=>a.paused))).toBe(true);await page.getByRole('button',{name:'Seguir',exact:true}).last().click();await expect.poll(()=>page.evaluate(()=>(window as Debug).__audios.some(a=>a.src.includes('music-game')&&!a.paused))).toBe(true);
  await page.getByRole('button',{name:'Volver a elegir civilización',exact:true}).click();await expect(page.locator('.land-pick')).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as Debug).__audios.filter(a=>a.src.includes('music-game')).every(a=>a.paused&&a.currentTime===0))).toBe(true);expect(errors).toEqual([]);
});
