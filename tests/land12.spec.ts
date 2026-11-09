import {expect,test} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import type {LandGame} from '../src/features/games/land';
const name=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name;
const base=process.env.LAND_BASE??(name==='minijuegos'?'/MiniJuegos/':'/escritorio-personal/');
interface DebugWindow extends Window{__landGame:()=>LandGame;__landCam:()=>{x:number;y:number;z:number};__menuPlays:string[];__radioFilters:BiquadFilterNode[];__voiceDurations:number[]}
test('Land 12: datos grandes, sonido de menú, radio humana y audio al explorar al rival',async({page},info)=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const w=window as DebugWindow;w.__menuPlays=[];w.__radioFilters=[];w.__voiceDurations=[];
    const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){w.__menuPlays.push(this.src);return play.call(this);};
    const filter=AudioContext.prototype.createBiquadFilter;AudioContext.prototype.createBiquadFilter=function(){const node=filter.call(this);w.__radioFilters.push(node);return node;};
    const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(when=0,offset=0,duration?:number){if(duration!==undefined)w.__voiceDurations.push(duration);start.call(this,when,offset,duration);};
  });
  await page.goto(base+'#/juegos');await page.getByRole('link',{name:/Land of Warriors/}).click();await page.getByRole('button',{name:/Iniciar/}).click();
  await page.getByLabel('Civilización del rival 1',{exact:true}).selectOption('elfos');await page.getByRole('button',{name:'Imperio Humano',exact:true}).click();
  await page.getByRole('button',{name:'¡VER!',exact:true}).click();
  const stats=page.locator('.land-info-grid article>small');await expect(stats.first()).toHaveCSS('font-size','20px');await expect(stats.last()).toHaveCSS('font-size','20px');
  await expect.poll(()=>page.evaluate(()=>(window as DebugWindow).__menuPlays.filter(s=>s.includes('menu-boton')).length)).toBe(4);
  await page.screenshot({path:info.outputPath('datos-grandes.png')});
  await page.getByRole('button',{name:/Elegir escenario/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await expect(page.getByTestId('land-energy')).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'Un trabajador sin hacer nada',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as DebugWindow).__radioFilters.some(n=>n.type==='highpass'&&n.frequency.value===400)),{timeout:15000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>(window as DebugWindow).__radioFilters.some(n=>n.type==='lowpass'&&n.frequency.value===2800))).toBe(true);
  await page.evaluate(()=>{const w=window as DebugWindow,g=w.__landGame(),u=g.units.find(u=>u.owner===1)!;g.ais.forEach(a=>a.t=Infinity);g.t+=10;const cam=w.__landCam();cam.x=u.x-70;cam.y=u.y-70;w.__voiceDurations=[];});
  await expect.poll(()=>page.evaluate(()=>(window as DebugWindow).__voiceDurations.some(n=>n>=.6&&n<=1.7)),{timeout:15000}).toBe(true);
  const poses=await page.evaluate(async base=>{const {drawSprite}=await import(base+'src/features/games/landArt.ts');const c=document.createElement('canvas');c.width=1080;c.height=720;const ctx=c.getContext('2d')!;ctx.fillStyle='#10253b';ctx.fillRect(0,0,c.width,c.height);for(let row=0;row<3;row++)for(let col=0;col<6;col++){drawSprite(ctx,row===2?'zergano':'humano',row===1?5:row===2?2:0,col*180+90,row*240+230,210,false,170,col*Math.PI/3);ctx.fillStyle='white';ctx.font='14px Arial';ctx.fillText(`${row===2?'Acechador':row===1?'Exoélite':'Ingeniero'} · ${col+1}`,col*180+15,row*240+18);}return c.toDataURL('image/png').split(',')[1];},base);
  writeFileSync(info.outputPath('caminata.png'),Buffer.from(poses,'base64'));
  expect(errors).toEqual([]);
});
