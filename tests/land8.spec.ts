import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import type { LandGame } from '../src/features/games/land';
const name=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name;
const base=process.env.LAND_BASE??(name==='minijuegos'?'/MiniJuegos/':'/escritorio-personal/');
interface DebugWindow extends Window { __landGame:()=>LandGame }
test('Land 8: infograma ancho, tipos de ataque, obra vacía y muro construible',async({page},info)=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#/juegos');await page.getByRole('link',{name:/Land of Warriors/}).click();
  await page.getByRole('button',{name:/Iniciar/}).click();await page.getByRole('button',{name:'Imperio Humano',exact:true}).click();
  const sheet=page.locator('.land-sheet-scroll'),picture=sheet.locator('img');await expect(picture).toBeVisible();
  const imgBox=(await picture.boundingBox())!,sheetBox=(await sheet.boundingBox())!;expect(Math.abs(imgBox.width-sheetBox.width)).toBeLessThan(20);
  await page.screenshot({path:info.outputPath('infograma.png')});
  await page.getByRole('button',{name:'Resumen',exact:true}).click();await expect(page.locator('.land-attack-type')).toHaveCount(6);
  await expect(page.locator('.land-simple-units li').nth(1)).toContainText('A distancia');
  await expect(page.locator('.land-simple-builds')).toContainText('Muralla de Acero');
  await page.screenshot({path:info.outputPath('resumen.png')});
  await page.getByRole('button',{name:'Infograma',exact:true}).click();await page.getByRole('button',{name:/Elegir escenario/}).click();
  await page.getByRole('button',{name:/Iniciar/}).click();await expect(page.getByTestId('land-stone')).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'Un trabajador sin hacer nada',exact:true}).click();
  await expect(page.getByRole('button',{name:/Muralla de Acero: Bloquea/})).toBeEnabled();
  await page.getByRole('button',{name:/Muralla de Acero: Bloquea/}).click();await expect(page.locator('.land-mode')).toContainText('Muralla de Acero');
  await page.locator('.land-mode').getByRole('button',{name:'Cancelar',exact:true}).click();
  if(info.project.name==='desktop'){
    const image=await page.evaluate(async base=>{
      const {addBuilding,addUnit}=await import(base+'src/features/games/land.ts');
      const {drawBuilding,drawSprite,drawUnit}=await import(base+'src/features/games/landArt.ts');
      const {CIV_IDS}=await import(base+'src/features/games/landCivs.ts');
      const g=(window as DebugWindow).__landGame();const out=document.createElement('canvas');out.width=1200;out.height=800;const ctx=out.getContext('2d')!;
      ctx.fillStyle='#172a32';ctx.fillRect(0,0,1200,800);ctx.fillStyle='#e9d8a8';ctx.font='16px sans-serif';
      CIV_IDS.forEach((c,i)=>{drawSprite(ctx,c,11,60+i*120,130,85,false,100);ctx.fillText(c,12+i*120,158);});
      [0,.5,.99,1].forEach((built,i)=>{const b=addBuilding(g,0,'barracks',150+i*280,410);b.built=built;drawBuilding(ctx,g,b,1,false);ctx.fillStyle='#fff';ctx.fillText(`${Math.round(built*100)}%`,100+i*280,445);g.buildings=g.buildings.filter(q=>q!==b);});
      ['humano','elfos','zergano','abisal','mecanico'].forEach((c,i)=>{const saved=g.sides[0].civ;g.sides[0].civ=c;const u=addUnit(g,0,'ranged',120+i*240,680);u.dead=.35;drawUnit(ctx,g,u,1,false);g.units=g.units.filter(q=>q!==u);g.sides[0].civ=saved;ctx.fillStyle='#fff';ctx.fillText(c,80+i*240,740);});
      return out.toDataURL('image/png').split(',')[1];
    },base);writeFileSync(info.outputPath('muros-obras-efectos.png'),Buffer.from(image,'base64'));
  }
  expect(errors).toEqual([]);
});
