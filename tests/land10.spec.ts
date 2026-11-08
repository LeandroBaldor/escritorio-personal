import { expect,test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { LandGame, BKind } from '../src/features/games/land';
import type { Cam } from '../src/features/games/landArt';
const name=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name;
const base=process.env.LAND_BASE??(name==='minijuegos'?'/MiniJuegos/':'/escritorio-personal/');
interface DebugWindow extends Window{__landGame:()=>LandGame;__landCam:()=>Cam}
test('Land 10: seis cuarteles, seis personajes exclusivos',async({page},info)=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#/juegos');await page.getByRole('link',{name:/Land of Warriors/}).click();await page.getByRole('button',{name:/Iniciar/}).click();
  await page.getByRole('button',{name:'Imperio Humano',exact:true}).click();
  await page.getByRole('button',{name:'¡VER!',exact:true}).click();
  const buildings=page.locator('.land-info-buildings article');await expect(buildings).toHaveCount(10);
  const recruits=['Ingeniero','Recluta','Fusilero Pesado','Médico','Tanque Bastión','Exoélite'];
  for(const unit of recruits)await expect(buildings.getByRole('heading',{name:`Cuartel ${unit}`,exact:true})).toBeVisible();
  await page.locator('.land-info-buildings').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('cuarteles-informe.png')});
  await page.getByRole('button',{name:/Elegir escenario/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await expect(page.getByTestId('land-energy')).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'Un trabajador sin hacer nada',exact:true}).click();
  await page.getByRole('button',{name:/^Cuartel Ingeniero:/}).click();await expect(page.locator('.land-build-preview h3')).toHaveText('Cuartel Ingeniero');
  await page.locator('.land-mode').getByRole('button',{name:'Cancelar',exact:true}).click();
  const kinds:BKind[]=['workerBarracks','barracks','rangedBarracks','specialBarracks','workshop','eliteBarracks'];
  for(const [i,kind] of kinds.entries()){
    const fixture=await page.evaluate(async({base,kind,i,mobile})=>{
      const {addBuilding}=await import(base+'src/features/games/land.ts');const w=window as DebugWindow,g=w.__landGame(),home=g.buildings.find(b=>b.owner===0&&b.kind==='base')!;
      g.sides[0].stone=g.sides[0].gem=g.sides[0].energy=5000;
      if(i===0)for(let j=0;j<6;j++)addBuilding(g,0,'depot',home.x,home.y-j*80).built=1;
      const b=addBuilding(g,0,kind,home.x+650+i*230,home.y-250);b.built=1;b.hp=b.maxHp;
      const c=w.__landCam();c.x=b.x-c.w*(mobile ? .25 : .72)/c.z;c.y=b.y-310/c.z;
      return {id:b.id,x:c.w*(mobile ? .25 : .72),y:270,role:(await import(base+'src/features/games/land.ts')).BUILD_STATS[kind].makes[0]};
    },{base,kind,i,mobile:info.project.name==='mobile'});
    const stage=(await page.locator('.land-stage>canvas').boundingBox())!;await page.mouse.click(stage.x+fixture.x,stage.y+fixture.y);
    await expect(page.locator('.land-build-preview h3')).toHaveText(`Cuartel ${recruits[i]}`);
    const trainButtons=page.locator('.land-cmds').getByRole('button',{name:/^(Ingeniero|Recluta|Fusilero Pesado|Médico|Tanque Bastión|Exoélite):/});
    await expect(trainButtons).toHaveCount(1);await expect(trainButtons).toHaveAttribute('aria-label',new RegExp(`^${recruits[i]}:`));
    await trainButtons.click();await trainButtons.click();
    expect(await page.evaluate(id=>(window as DebugWindow).__landGame().buildings.find(b=>b.id===id)!.queue,fixture.id)).toEqual([fixture.role,fixture.role]);
  }
  await page.screenshot({path:info.outputPath('cuartel-exclusivo.png')});expect(errors).toEqual([]);
});
