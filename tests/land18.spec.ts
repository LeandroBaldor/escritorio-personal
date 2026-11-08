import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import type {LandGame} from '../src/features/games/land';
const name=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name;
const base=process.env.LAND_BASE??(name==='minijuegos'?'/MiniJuegos/':'/escritorio-personal/');
interface Debug extends Window{__landGame:()=>LandGame}
test('Land 18: mejoras de base, costos, cuatro niveles y regreso a civilizaciones',async({page},info)=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#/juegos');await page.getByRole('link',{name:/Land of Warriors/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await page.getByRole('button',{name:'Imperio Humano',exact:true}).click();await page.getByRole('button',{name:/Continuar/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await expect(page.getByTestId('land-rock')).toHaveText('350',{timeout:30000});
  await page.evaluate(()=>{const g=(window as Debug).__landGame();g.ais.forEach(a=>a.t=Infinity);g.sides[0].stone=g.sides[0].gem=g.sides[0].energy=g.sides[0].rock=5000;});
  await page.getByRole('button',{name:'Ir a la base',exact:true}).click();const panel=page.getByRole('region',{name:'Información de selección'});
  await panel.getByRole('tab',{name:'Construcciones',exact:true}).click();await expect(panel).toContainText('Producción');await expect(panel).toContainText('160 azules');await expect(panel).toContainText('140 piedras');
  const production=page.getByRole('button',{name:/^Mejorar Producción:/});await production.click();await expect(panel).toContainText('Investigando Producción');await expect(page.getByTestId('land-rock')).toHaveText('4960');
  await page.evaluate(()=>{const g=(window as Debug).__landGame();g.buildings.find(b=>b.owner===0&&b.infrastructureResearch)!.infrastructureResearch!.elapsed=25;});await expect(panel).toContainText('Producción · Nivel 1 / 3');
  await page.screenshot({path:info.outputPath('base-mejoras.png')});await expect.poll(()=>panel.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(2);
  await panel.getByRole('tab',{name:'Economía',exact:true}).click();await expect(panel).toContainText('×3.54');await expect(panel).toContainText('300');await expect.poll(()=>panel.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(2);await page.screenshot({path:info.outputPath('economia-niveles.png')});
  if(info.project.name==='desktop'){
    const atlas=await page.evaluate(async base=>{const art=await import(base+'src/features/games/landArt.ts'),{CIV_IDS,CIVS}=await import(base+'src/features/games/landCivs.ts'),{ROLES,unitStats}=await import(base+'src/features/games/land.ts');await new Promise<void>(resolve=>{const poll=()=>art.spritesReady()?resolve():setTimeout(poll,50);poll();});const g=(window as Debug).__landGame(),canvas=document.createElement('canvas');canvas.width=1100;canvas.height=60*180+40;const c=canvas.getContext('2d')!;c.fillStyle='#091727';c.fillRect(0,0,canvas.width,canvas.height);for(let lv=1;lv<=4;lv++){c.fillStyle='#efdba0';c.font='bold 18px Arial';c.fillText('Nivel '+lv,210+lv*180,26);}CIV_IDS.forEach((civ,j)=>ROLES.forEach((role,r)=>{g.sides[0].civ=civ;const row=j*6+r,y=40+row*180;c.fillStyle=row%2?'#102539':'#0a1e30';c.fillRect(0,y,1100,180);c.fillStyle='#d4e9f6';c.font='12px Arial';c.fillText(CIVS[civ].name,8,y+24);c.fillText(CIVS[civ].units[role],8,y+43);for(let lv=1;lv<=4;lv++)art.drawSprite(c,civ,r,250+lv*180,y+170,unitStats(g,0,role,lv).size*.48,false,168,0,0,0,lv);}));g.sides[0].civ='humano';return canvas.toDataURL('image/png').split(',')[1];},base);writeFileSync(info.outputPath('evoluciones-18.png'),Buffer.from(atlas,'base64'));
  }
  await page.getByRole('button',{name:'Volver a elegir civilización',exact:true}).click();await expect(page.getByLabel('Enemigos',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Imperio Humano',exact:true})).toHaveAttribute('aria-pressed','true');expect(errors).toEqual([]);
});
