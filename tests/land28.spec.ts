import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {LandGame} from '../src/features/games/land';
import type {Cam} from '../src/features/games/landArt';
const name=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name,base=name==='minijuegos'?'/MiniJuegos/':'/escritorio-personal/';
interface Debug extends Window{__landGame:()=>LandGame;__landCam:()=>Cam}
test('Land: base y cuarteles conservan las dimensiones de MENU.png',async({page},info)=>{
 test.skip(info.project.name==='mobile','Proporción del marco panorámico de la referencia.');
 test.setTimeout(120000);
 await page.goto(base+'#/juegos');await page.getByRole('link',{name:/Land of Warriors/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await page.getByRole('button',{name:/Continuar/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await expect(page.getByTestId('land-rock')).toBeVisible({timeout:30000});
 const id=await page.evaluate(async base=>{const {addBuilding}=await import(base+'src/features/games/land.ts'),g=(window as Debug).__landGame();g.ais.forEach(a=>a.t=Infinity);const b=addBuilding(g,0,'workerBarracks',2200,1700);b.built=1;b.hp=b.maxHp;b.queue=Array.from({length:9},()=>'worker');b.qT=12;return b.id;},base);
 const hud=page.locator('.land-hud'),panel=page.getByRole('region',{name:'Información de selección'});
 for(const [width,height] of [[1102,720],[1280,720],[1440,900],[1672,941],[1920,1080]]){
  await page.setViewportSize({width,height});await page.keyboard.press('Escape');
  const expected=(await hud.boundingBox())!.width*261/1342;
  await expect.poll(async()=>Math.abs((await hud.boundingBox())!.height-expected)).toBeLessThan(1);
  await page.getByRole('button',{name:'Ir a la base',exact:true}).click();
  for(const tab of ['Aldea','Construcciones','Economía']){await panel.getByRole('tab',{name:tab,exact:true}).click();expect(Math.abs((await hud.boundingBox())!.height-expected)).toBeLessThan(1);}
  if(width===1672){await panel.getByRole('tab',{name:'Aldea',exact:true}).click();await page.screenshot({path:info.outputPath('referencia-base.png')});}
  await page.keyboard.press('Escape');const point=await page.evaluate(id=>{const d=window as Debug,b=d.__landGame().buildings.find(b=>b.id===id)!,c=d.__landCam();c.x=b.x-c.w*.65/c.z;c.y=b.y-150/c.z;return {x:.65,y:130/c.h};},id),stage=(await page.locator('.land-stage>canvas').boundingBox())!;await page.mouse.click(stage.x+stage.width*point.x,stage.y+stage.height*point.y);
  await expect(panel.locator('h3')).toContainText('Cuartel');expect(Math.abs((await hud.boundingBox())!.height-expected)).toBeLessThan(1);
  await expect(panel.locator('.land-training-cards li')).toHaveCount(3);
  expect(await panel.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(2);
  await panel.getByRole('button',{name:'Ver mejoras',exact:true}).click();expect(Math.abs((await hud.boundingBox())!.height-expected)).toBeLessThan(1);
  await panel.getByRole('button',{name:'Ver características',exact:true}).click();
  if(width===1672)await page.screenshot({path:info.outputPath('referencia-cuartel.png')});
 }
});
