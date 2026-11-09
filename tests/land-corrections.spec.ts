import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import type { LandGame } from '../src/features/games/land';
import type { Cam } from '../src/features/games/landArt';

interface LandDebugWindow extends Window { __landGame: () => LandGame; __landCam: () => Cam }

const packageName = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).name;
const base = process.env.LAND_BASE ?? (packageName === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/');
test('Land: civilizaciones, escala, exploración, selección y HUD', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}#/juegos`);
  await page.getByRole('link', { name: /Land of Warriors/ }).click();
  await page.getByRole('button', { name: /Iniciar/ }).click();
  const civs = page.getByLabel('Las 10 civilizaciones');
  await expect(civs.getByRole('button')).toHaveCount(10);
  await expect.poll(() => civs.locator('canvas').evaluateAll(canvases => canvases.filter(canvas => {
    const c = canvas as HTMLCanvasElement, data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    return data.some((value, i) => i % 4 === 3 && value > 180);
  }).length), { timeout: 20000 }).toBe(10);
  const portraits=page.locator('.land-civ-face .land-leader-portrait');await expect(portraits).toHaveCount(10);
  await portraits.evaluateAll(async elements=>{await Promise.all(elements.map(async el=>{const image=new Image(),source=el.querySelector('image')?.getAttribute('href');if(!source)throw new Error('Falta el retrato del líder');image.src=source;await image.decode();}));});
  if (testInfo.project.name === 'desktop') {
    const atlas = await page.evaluate(async base => {
      const art = await import(`${base}src/features/games/landArt.ts`), { CIV_IDS, CIVS } = await import(`${base}src/features/games/landCivs.ts`);
      const c = document.createElement('canvas'); c.width = 1408; c.height = 1440; const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#122031'; ctx.fillRect(0, 0, c.width, c.height);
      CIV_IDS.forEach((civ: string, row: number) => {
        ctx.fillStyle = '#dcefff'; ctx.font = '13px sans-serif'; ctx.fillText(CIVS[civ].name, 8, row * 144 + 16);
        for (let idx = 0; idx < 11; idx++) art.drawSprite(ctx, civ, idx, idx * 128 + 64, row * 144 + 140, 116, false, 120);
      });
      return c.toDataURL('image/png').split(',')[1];
    }, base);
    writeFileSync(testInfo.outputPath('atlas.png'), Buffer.from(atlas, 'base64'));
  }
  await expect(page.getByRole('group', { name: 'Tamaño del mapa' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Dificultad' }).getByRole('button')).toHaveCount(4);
  await page.getByRole('button', { name: 'Muy fácil', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('civilizaciones.png') });
  await page.getByRole('button', { name: 'Imperio Humano', exact: true }).click();
  await page.getByRole('button', { name: /Continuar/ }).click();
  const sizes = page.getByRole('group', { name: 'Tamaño del mapa' });
  await expect(sizes.getByRole('button')).toHaveCount(4);
  await sizes.getByRole('button', { name: /Muy grande/ }).click();
  await page.getByRole('group', { name: 'Elegir escenario' }).getByRole('button').nth(4).click();
  await expect(page.locator('.land-scen-list img')).toHaveCount(10, { timeout: 20000 });
  await page.screenshot({ path: testInfo.outputPath('escenarios.png') });
  await page.getByRole('button', { name: /Iniciar/ }).click();
  const world = page.getByRole('img', { name: /Partida en Frontera/ });
  await expect(world).toBeVisible({ timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (window as LandDebugWindow).__landGame?.()?.terrain.w)).toBe(12800);
  const camera = () => page.evaluate(() => ({ ...(window as LandDebugWindow).__landCam() }));
  const initial = await camera(); expect(initial.z).toBe((1.6/1.1)/1.2);
  const bounds = (await world.boundingBox())!;
  const x = bounds.x + bounds.width * .7, y = bounds.y + Math.min(220, (bounds.height - 320) * .6);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 70, y - 30, { steps: 12 }); await page.mouse.up();
  const moved = await camera(); expect(moved.x).toBeGreaterThan(initial.x + 25);
  expect(moved.y).toBeGreaterThan(initial.y + 10);
  await page.mouse.wheel(0, -500);
  await expect.poll(async () => (await camera()).z).toBeGreaterThan(initial.z);
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 500);
  await expect.poll(async () => (await camera()).z).toBe((1.6 / 1.1)/1.2);
  const mini = page.getByLabel('Mapa', { exact: true });
  const mb = (await mini.boundingBox())!;
  await page.mouse.click(mb.x + mb.width * .13, mb.y + mb.height * .76);
  await expect.poll(async () => (await camera()).x).toBeLessThan(1800);
  await page.getByRole('button', { name: 'Ir a la base', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Información de selección', exact: true }).filter({ hasText: 'Centro de Mando' })).toHaveCount(1);
  await page.keyboard.press('Escape');
  const worker = await page.evaluate(() => {
    const g = (window as LandDebugWindow).__landGame(), u = g.units.find((u) => u.owner === 0 && u.role === 'worker');
    return { x: u.x / g.terrain.w, y: u.y / g.terrain.h };
  });
  await page.mouse.click(mb.x + mb.width * worker.x, mb.y + mb.height * worker.y);
  const point = await page.evaluate(() => {
    const d = window as LandDebugWindow, u = d.__landGame().units.find(u => u.owner === 0 && u.role === 'worker')!, c = d.__landCam();
    return { x: (u.x-c.x)*c.z, y: (u.y-c.y)*c.z };
  });
  const direction = testInfo.project.name === 'desktop' ? 1 : -1; // Comenzar fuera de la tarjeta ampliada.
  await page.keyboard.down('Shift');
  await page.mouse.move(bounds.x + Math.max(5,Math.min(bounds.width-5,point.x+direction*70)), bounds.y + Math.max(100,point.y-110));
  await page.mouse.down(); await page.mouse.move(bounds.x + Math.max(5,Math.min(bounds.width-5,point.x-direction*70)), bounds.y + Math.min(bounds.height-230,point.y+20), { steps: 8 }); await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.screenshot({ path: testInfo.outputPath('seleccion.png') });
  await expect(page.locator('.land-group button')).not.toHaveCount(0);
  await page.keyboard.press('p');
  await expect(page.getByRole('heading', { name: 'Pausa', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Seguir', exact: true }).click();
  await page.getByRole('button', { name: 'Ir a la base', exact: true }).click();
  await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + 160);
  await page.waitForTimeout(1500); // Permite completar el primer plano de alta resolución.
  await page.screenshot({ path: testInfo.outputPath('partida.png') });
  expect(errors).toEqual([]);
  expect(await page.locator('.land-hud').evaluate(el => el.scrollWidth <= el.clientWidth + 2)).toBe(true);
});
