import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {LandGame} from '../src/features/games/land';
const name=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name;
const base=process.env.LAND_BASE??(name==='minijuegos'?'/MiniJuegos/':'/escritorio-personal/');
interface DebugWindow extends Window{__landGame:()=>LandGame;__combatDurations:number[]}
test('Land 11: el líder recibe avisos y el combate usa los archivos nuevos',async({page},info)=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const w=window as DebugWindow;w.__combatDurations=[];const original=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(when=0,offset=0,duration?:number){if(duration!==undefined)w.__combatDurations.push(duration);original.call(this,when,offset,duration);};});
  await page.goto(base+'#/juegos');await page.getByRole('link',{name:/Land of Warriors/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await page.getByRole('button',{name:'Imperio Humano',exact:true}).click();await page.getByRole('button',{name:/Continuar/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await expect(page.getByTestId('land-energy')).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'Un trabajador sin hacer nada',exact:true}).click();
  const toggle=page.getByRole('button',{name:'Tropas y líder',exact:true});if(await toggle.isVisible())await toggle.click();
  const log=page.getByRole('log',{name:'Mensajes del líder'});await log.scrollIntoViewIfNeeded();await expect(log).toContainText('Ya estamos en posición');await expect(page.locator('.land-toast')).toHaveCount(0);
  await page.evaluate(async base=>{
    const {addUnit}=await import(base+'src/features/games/land.ts');const g=(window as DebugWindow).__landGame(),u=g.units.find(u=>u.owner===0)!;g.ais.forEach(a=>a.t=Infinity);g.t=20;g.sides[0].stone=0;g.sides[0].gem=0;g.sides[0].energy=0;addUnit(g,0,'ranged',u.x,u.y);
    const enemy=addUnit(g,1,'ranged',u.x+300,u.y);enemy.order={k:'move',x:u.x,y:u.y,attack:true};
    g.events.push({type:'shot',owner:0,role:'heavy',x:u.x,y:u.y},{type:'impact',owner:0,x:u.x,y:u.y},{type:'die',owner:1,by:0,building:false,x:u.x,y:u.y});
  },base);
  await expect(log).toContainText('Detecté tropas enemigas');await expect(log).toContainText('reservas de cristales azules');await expect(page.locator('.land-command-heading')).toContainText('1 soldado listo para luchar');
  await expect.poll(()=>page.evaluate(()=>(window as DebugWindow).__combatDurations.some(n=>Math.abs(n-1.553)<.01)),{timeout:10000}).toBe(true);
  await expect(log).toContainText('bajas propias y 1 bajas enemigas',{timeout:10000});await page.getByRole('button',{name:'Ayuda',exact:true}).click();await expect(log).toContainText('Tocá para elegir');
  await log.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('lider-combate.png')});expect(errors).toEqual([]);
});
