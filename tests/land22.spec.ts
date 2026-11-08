import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {LandGame} from '../src/features/games/land';
const name=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name;
const base=name==='minijuegos'?'/MiniJuegos/':'/escritorio-personal/';
interface Debug extends Window{__landGame:()=>LandGame}
test('Land: actividades agrupadas y texto dentro de cada ventana del HUD',async({page},info)=>{
  test.setTimeout(120000);await page.goto(base+'#/juegos');await page.getByRole('link',{name:/Land of Warriors/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await page.getByRole('button',{name:/Continuar/}).click();await page.getByRole('button',{name:/Iniciar/}).click();await expect(page.getByTestId('land-rock')).toBeVisible({timeout:30000});
  await page.evaluate(async base=>{const {addUnit}=await import(base+'src/features/games/land.ts');const g=(window as Debug).__landGame();g.ais.forEach(a=>a.t=Infinity);g.units=[];const b=g.buildings.find(b=>b.owner===0&&b.kind==='base')!;g.nodes=[];for(const [i,kind] of (['stone','gem','energy','rock'] as const).entries()){const node={id:99000+i,kind,x:b.x+100+i*50,y:b.y+100,amount:999999};g.nodes.push(node);for(let n=0;n<(i===0?3:2);n++){const u=addUnit(g,0,'worker',b.x,b.y);u.order={k:'gather',node:node.id};}}for(let n=0;n<2;n++)addUnit(g,0,'heavy',b.x,b.y);},base);
  await page.getByRole('button',{name:'Ir a la base',exact:true}).click();const panel=page.getByRole('region',{name:'Información de selección'}),pop=page.getByRole('region',{name:'Composición de la aldea'});await expect(pop).toContainText('Total de habitantes: 11');await expect(pop.locator('article').first()).toContainText('Ingenieros (3):');await expect(pop.locator('article').first()).toContainText('minerales azules');await expect(pop.locator('article')).toHaveCount(2);
  const sizes=info.project.name==='desktop'?[1280,1672,1920]:[393];
  for(const width of sizes){await page.setViewportSize({width,height:width===393?851:941});for(let p=0;p<3;p++){
    const cards=pop.locator('.land-summary-tasks article');await expect.poll(()=>cards.evaluateAll(els=>els.every(el=>[el,...el.querySelectorAll('b,span')].every(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1)))).toBe(true);
    await expect.poll(()=>panel.evaluate(e=>e.scrollHeight-e.clientHeight)).toBeLessThanOrEqual(2);
    if(width>1100){const hud=(await page.locator('.land-hud').boundingBox())!;for(const card of await cards.all()){const r=(await card.boundingBox())!;expect(r.x).toBeGreaterThanOrEqual(hud.x+hud.width*.22);expect(r.x+r.width).toBeLessThanOrEqual(hud.x+hud.width*.525);}}
    if(p<2)await pop.getByRole('button',{name:'Actividades siguientes',exact:true}).click();
  }await expect(pop).toContainText('Tanques Bastión (2):');await pop.getByRole('button',{name:'Actividades anteriores',exact:true}).click();await pop.getByRole('button',{name:'Actividades anteriores',exact:true}).click();
    const civs=await page.evaluate(async base=>(await import(base+'src/features/games/landCivs.ts')).CIV_IDS,base);
    for(const civ of civs){const label=await page.evaluate(async({base,civ})=>{const {CIVS}=await import(base+'src/features/games/landCivs.ts'),{troopGroupName}=await import(base+'src/features/games/landActivity.ts');(window as Debug).__landGame().sides[0].civ=civ;return troopGroupName(CIVS[civ].units.worker,3);},{base,civ});await expect(pop.locator('article').first()).toContainText(label);expect(await pop.locator('article').evaluateAll(els=>els.every(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1))).toBe(true);}
    await page.evaluate(()=>(window as Debug).__landGame().sides[0].civ='humano');await expect(pop.locator('article').first()).toContainText('Ingenieros');
    if(width>1100){const totals=pop.locator('.land-population-totals');await expect.poll(()=>totals.evaluate(el=>{const r=el.getBoundingClientRect(),front=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!front&&el.contains(front);})).toBe(true);}
    await page.screenshot({path:info.outputPath('aldea-'+width+'.png')});}
});
