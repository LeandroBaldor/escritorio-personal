import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const base=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name==='minijuegos'?'/MiniJuegos/':'/escritorio-personal/';
interface Debug extends Window{__ambience:HTMLAudioElement[];__landGame:()=>{map:number}}
test('Land: ambiente del mapa en bucle, independiente de la música y detenido fuera de la partida',async({page})=>{
 test.setTimeout(90000);await page.addInitScript(()=>{const w=window as Debug;w.__ambience=[];const Native=window.Audio;window.Audio=class extends Native{constructor(src?:string){super(src);if(src?.includes('/ambience/'))w.__ambience.push(this);}};});
 await page.goto(base+'#/juegos');await page.getByRole('link',{name:/Land of Warriors/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await page.getByRole('button',{name:/Continuar/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await expect(page.getByTestId('land-rock')).toBeVisible({timeout:30000});
 await expect.poll(()=>page.evaluate(()=>{const w=window as Debug,a=w.__ambience.at(-1);return !!a&&!a.paused&&a.loop&&a.src.includes(`map-${w.__landGame().map}.mp3`);})).toBe(true);
 await page.getByRole('button',{name:'Silenciar música de la partida',exact:true}).click();expect(await page.evaluate(()=>(window as Debug).__ambience.at(-1)!.paused)).toBe(false);
 await page.getByRole('button',{name:'Pausa',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as Debug).__ambience.every(a=>a.paused))).toBe(true);
 await page.getByRole('button',{name:'Seguir',exact:true}).last().click();await expect.poll(()=>page.evaluate(()=>(window as Debug).__ambience.some(a=>!a.paused))).toBe(true);
 await page.getByRole('button',{name:'Volver a elegir civilización',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as Debug).__ambience.every(a=>a.paused&&a.currentTime===0))).toBe(true);
});
