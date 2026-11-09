import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {LandGame} from '../src/features/games/land';
const name=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name;
const base=process.env.LAND_BASE??(name==='minijuegos'?'/MiniJuegos/':'/escritorio-personal/');
interface Debug extends Window{__landGame:()=>LandGame}
test('Land 16: cabezas completas, información junto al minimapa y órdenes explicadas',async({page},info)=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#/juegos');await page.getByRole('link',{name:/Land of Warriors/}).click();await page.getByRole('button',{name:/Iniciar/}).click();
  const portraits=page.locator('.land-civ-face .land-leader-portrait svg');await expect(portraits).toHaveCount(10);expect(await portraits.evaluateAll(els=>new Set(els.map(el=>el.getAttribute('viewBox'))).size)).toBe(5);
  await page.getByRole('button',{name:'Imperio Sauriano',exact:true}).click();const picture=page.getByRole('region',{name:'Civilización elegida'}).getByRole('img',{name:'Líder de Imperio Sauriano'});const box=(await picture.boundingBox())!;expect(Math.abs(box.width-box.height)).toBeLessThan(2);await page.screenshot({path:info.outputPath('retratos-completos.png')});
  await page.getByRole('button',{name:/Continuar/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await expect(page.getByTestId('land-energy')).toBeVisible({timeout:30000});
  await page.evaluate(async base=>{const {addUnit,addBuilding}=await import(base+'src/features/games/land.ts');const g=(window as Debug).__landGame();g.ais.forEach(a=>a.t=Infinity);const workers=g.units.filter(u=>u.owner===0);g.nodes=[{id:9999,kind:'stone',x:workers[0].x+20,y:workers[0].y,amount:500}];workers[0].order={k:'gather',node:9999};workers[1].order={k:'move',x:workers[1].x+300,y:workers[1].y};addUnit(g,0,'ranged',workers[0].x+40,workers[0].y+20);const b=addBuilding(g,0,'rangedBarracks',workers[0].x+400,workers[0].y+100);b.built=1;g.sides[0].levels.worker=1;},base);
  await page.getByRole('button',{name:'Ir a la base',exact:true}).click();const panel=page.getByRole('region',{name:'Información de selección'});await expect(panel).toContainText('Total de habitantes: 5');await panel.getByRole('button',{name:/^Azules:/}).click();await expect(panel).toContainText('Recolección');const mini=(await page.locator('.land-mini').boundingBox())!,inspector=(await panel.boundingBox())!;expect(inspector.x).toBeGreaterThanOrEqual(mini.x+mini.width-3);await page.screenshot({path:info.outputPath('base-actividad.png')});
  await page.getByRole('button',{name:'Un trabajador sin hacer nada',exact:true}).click();await expect(panel.getByRole('progressbar',{name:'Progreso total de mejoras'})).toHaveAttribute('aria-valuenow','13');await expect(panel).toContainText('Nivel 1 / 4');await expect(panel).toContainText('Cuartel Saurling');
  const command=page.getByRole('button',{name:/^Cuartel Saurling:/});await expect(command.locator('.land-command-label')).toContainText('Cuartel');await command.hover();await expect(page.getByRole('tooltip')).toContainText('Entrena');await page.screenshot({path:info.outputPath('orden-explicada.png')});expect(errors).toEqual([]);
});
