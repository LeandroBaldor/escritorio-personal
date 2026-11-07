import { expect,test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { LandGame } from '../src/features/games/land';
const name=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name;
const base=process.env.LAND_BASE??(name==='minijuegos'?'/MiniJuegos/':'/escritorio-personal/');
interface DebugWindow extends Window{__landGame:()=>LandGame}
test('Land 9: informe, líder, actividad de tropas y construcción ampliada',async({page},info)=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#/juegos');await page.getByRole('link',{name:/Land of Warriors/}).click();await page.getByRole('button',{name:/Iniciar/}).click();
  await page.getByRole('button',{name:'Imperio Humano',exact:true}).click();
  await page.getByRole('button',{name:'Ver infograma',exact:true}).click();
  await expect(page.locator('.land-info-grid article')).toHaveCount(16);await expect(page.getByRole('img',{name:'Líder de Imperio Humano',exact:true})).toBeVisible();
  await expect(page.locator('.land-infographic')).not.toContainText('VISTA EN EL JUEGO');await page.screenshot({path:info.outputPath('informe.png')});
  await page.getByRole('button',{name:/Elegir escenario/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await expect(page.getByTestId('land-energy')).toBeVisible({timeout:30000});
  const open=async()=>{if(info.project.name==='mobile')await page.getByRole('button',{name:'Tropas y líder',exact:true}).click();};await open();
  await expect(page.locator('.land-own-intel')).not.toContainText('RIVAL');await expect(page.locator('.land-own-intel').getByRole('img',{name:'Líder de Imperio Humano',exact:true})).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);await expect(page.getByRole('region',{name:'Tropas y actividad',exact:true})).toBeVisible();
  await expect(page.locator('.land-troop-row')).toHaveCount(1);
  await expect(page.locator('.land-troop-row')).toContainText('Ingenieros (4):');
  await page.evaluate(async base=>{const {addUnit,orderMove}=await import(base+'src/features/games/land.ts');const g=(window as DebugWindow).__landGame();const w=g.units.find(u=>u.owner===0)!;const a=addUnit(g,0,'ranged',w.x+10,w.y+20);orderMove(g,[a.id],w.x+400,w.y+100);},base);
  await page.getByRole('button',{name:'Ejército 1',exact:true}).click();await expect(page.locator('.land-troop-row')).toHaveCount(1);await expect(page.locator('.land-troop-row')).toContainText('Marchando');
  await page.screenshot({path:info.outputPath('tropas.png')});await page.locator('.land-troop-row').click();await open();
  await expect(page.locator('.land-troop-row')).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Trabajadores 4',exact:true}).click();await expect(page.locator('.land-troop-row')).toHaveCount(1);
  await page.locator('.land-troop-row').first().click();
  await page.getByRole('button',{name:/Cuartel Recluta: Entrena/}).click();await expect(page.getByRole('region',{name:'Vista ampliada de construcción',exact:true})).toContainText('Cuartel');
  const preview=(await page.locator('.land-build-preview').boundingBox())!;expect(preview.width).toBeGreaterThan(180);
  await page.screenshot({path:info.outputPath('construccion.png')});await page.locator('.land-mode').getByRole('button',{name:'Cancelar',exact:true}).click();
  await open();await page.evaluate(async base=>{
    const {addUnit}=await import(base+'src/features/games/land.ts');const g=(window as DebugWindow).__landGame(),w=g.units.find(u=>u.owner===0&&u.role==='worker')!;
    addUnit(g,0,'worker',w.x+20,w.y);const workers=g.units.filter(u=>u.owner===0&&u.role==='worker'),gold=g.nodes.find(n=>n.kind==='gem')!,blue=g.nodes.find(n=>n.kind==='stone')!;
    workers.forEach((u,i)=>{u.order={k:'gather',node:i<2?gold.id:blue.id};});
  },base);
  await expect(page.locator('.land-troop-row')).toHaveCount(2);
  const gold=page.getByRole('button',{name:'Ingenieros (2): Recolección de oro',exact:true});
  await expect(gold).toBeVisible();await expect(page.getByRole('button',{name:'Ingenieros (3): Recolección de cristales azules',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('resumen-tropas.png')});await gold.click();await expect(page.locator('.land-group button')).toHaveCount(2);
  expect(errors).toEqual([]);
});
