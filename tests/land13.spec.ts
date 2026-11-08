import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {LandGame} from '../src/features/games/land';
import type {Cam} from '../src/features/games/landArt';
const name=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name;
const base=process.env.LAND_BASE??(name==='minijuegos'?'/MiniJuegos/':'/escritorio-personal/');
interface Debug extends Window{__landGame:()=>LandGame;__landCam:()=>Cam;__steps:number[]}
test('Land 13: ficha elegida, enemigos, líder ampliado y población del Nido Sauriano',async({page},info)=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const w=window as Debug;w.__steps=[];const original=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(when=0,offset=0,duration?:number){if(duration!==undefined&&duration<=.151)w.__steps.push(duration);original.call(this,when,offset,duration);};});
  await page.goto(base+'#/juegos');await page.getByRole('link',{name:/Land of Warriors/}).click();await page.getByRole('button',{name:/Iniciar/}).click();
  await page.getByRole('button',{name:'Imperio Sauriano',exact:true}).click();const card=page.getByRole('region',{name:'Civilización elegida'});await expect(card).toContainText('Imperio Sauriano');await expect(page.locator('.land-sheet')).toHaveCount(0);
  await page.getByLabel('Enemigos',{exact:true}).selectOption('2');await expect(page.locator('.land-rival-selectors select')).toHaveCount(2);
  await page.getByLabel('Civilización del rival 1',{exact:true}).selectOption('orcos');await page.getByLabel('Civilización del rival 2',{exact:true}).selectOption('elfos');
  if(info.project.name==='desktop'){const list=(await page.locator('.land-civ-list').boundingBox())!,chosen=(await card.boundingBox())!;expect(chosen.x).toBeGreaterThan(list.x+list.width-2);}
  await page.screenshot({path:info.outputPath('seleccion.png')});await page.getByRole('button',{name:/Continuar/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await expect(page.getByTestId('land-energy')).toBeVisible({timeout:30000});
  await expect(page.locator('.land-colony-card')).toHaveCount(0);const toggle=page.getByRole('button',{name:'Tropas y líder',exact:true});if(await toggle.isVisible())await toggle.click();const leader=page.getByRole('region',{name:'Comunicaciones del líder'});await leader.scrollIntoViewIfNeeded();expect((await leader.boundingBox())!.height).toBeGreaterThanOrEqual(320);if(await toggle.isVisible())await toggle.click();
  await page.getByRole('button',{name:'Ir a la base',exact:true}).click();
  const point=await page.evaluate(()=>{const w=window as Debug,g=w.__landGame(),b=g.buildings.find(b=>b.owner===0&&b.kind==='base')!,c=w.__landCam();return {x:(b.x-c.x)*c.z,y:(b.y-35-c.y)*c.z};});const world=(await page.locator('.land-stage>canvas').boundingBox())!;await page.mouse.click(world.x+point.x,world.y+point.y);
  const population=page.getByRole('region',{name:'Composición de la aldea'});await expect(population).toContainText('Total de habitantes: 4');await expect(population).toContainText('Saurling');await expect(population).toContainText('Triceratops de Asalto');
  await page.evaluate(async base=>{const {addUnit}=await import(base+'src/features/games/land.ts');const g=(window as Debug).__landGame(),u=g.units.find(u=>u.owner===0)!;g.ais.forEach(a=>a.t=Infinity);addUnit(g,0,'heavy',u.x,u.y);},base);await expect(population).toContainText('Total de habitantes: 5');await expect(population.locator('article').filter({hasText:'Triceratops de Asalto'})).toContainText('1');
  await page.screenshot({path:info.outputPath('nido-poblacion.png')});
  await page.getByRole('button',{name:'Un trabajador sin hacer nada',exact:true}).click();await page.evaluate(async base=>{const {orderMove}=await import(base+'src/features/games/land.ts'),{GROUND,T}=await import(base+'src/features/games/landMap.ts');const g=(window as Debug).__landGame(),u=g.units.find(u=>u.owner===0&&u.role==='worker')!;for(let y=Math.floor((u.y-60)/T);y<=Math.floor((u.y+60)/T);y++)for(let x=Math.floor((u.x-60)/T);x<=Math.floor((u.x+800)/T);x++)if(x>=0&&y>=0&&x<g.terrain.cols&&y<g.terrain.rows)g.terrain.cells[y*g.terrain.cols+x]=GROUND;orderMove(g,[u.id],u.x+700,u.y);},base);
  await page.waitForTimeout(600);expect(await page.evaluate(()=>(window as Debug).__steps.length)).toBe(0);expect(errors).toEqual([]);
});
