import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import type { LandGame } from '../src/features/games/land';
import type { Cam } from '../src/features/games/landArt';
interface LandDebug extends Window { __landGame: () => LandGame; __landCam: () => Cam }
const name = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).name;
const base = process.env.LAND_BASE ?? (name === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/');

test('Land 7: lista de rivales, fotografías, energía y geometría del menú', async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '#/juegos');
  await page.getByRole('link', { name: /Land of Warriors/ }).click();
  await page.getByRole('button', { name: /Iniciar/ }).click();
  const count = page.getByLabel('Enemigos', { exact: true });
  await count.selectOption('3');
  await expect(page.locator('.land-rival-selectors select')).toHaveCount(3);
  await page.getByLabel('Civilización del rival 1', { exact: true }).selectOption('orcos');
  await page.getByLabel('Civilización del rival 2', { exact: true }).selectOption('elfos');
  await page.getByLabel('Civilización del rival 3', { exact: true }).selectOption('zergano');
  await page.screenshot({ path: info.outputPath('seleccion-rivales.png') });
  await page.getByRole('button', { name: 'Imperio Humano', exact: true }).click();
  await page.getByRole('button', { name: /Continuar/ }).click();
  await expect(page.locator('.land-scen-list img')).toHaveCount(10);
  await expect.poll(() => page.locator('.land-scen-list img').evaluateAll(images => images.filter(img => (img as HTMLImageElement).naturalWidth > 0 && (img as HTMLImageElement).src.includes('scene-')).length)).toBe(10);
  await page.screenshot({ path: info.outputPath('paisajes.png') });
  await page.getByRole('button', { name: /Iniciar/ }).click();
  await expect(page.getByTestId('land-energy')).toHaveText('0', { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (window as LandDebug).__landGame().sides.length)).toBe(4);
  const factions = await page.evaluate(() => (window as LandDebug).__landGame().sides.map(s => s.civ));
  expect(factions).toEqual(['humano', 'orcos', 'elfos', 'zergano']);
  await page.getByRole('button', { name: 'Ir a la base', exact: true }).click();
  const point = await page.evaluate(() => {
    const d = window as LandDebug, u = d.__landGame().units.find(u => u.owner === 0 && u.role === 'worker')!, c = d.__landCam();
    return { x: (u.x - c.x) * c.z, y: (u.y - 30 - c.y) * c.z };
  });
  const world = (await page.locator('.land-stage>canvas').boundingBox())!;
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Un trabajador sin hacer nada', exact: true }).click();
  else await page.mouse.dblclick(world.x + point.x, world.y + point.y);
  await expect(page.locator('.land-group button')).not.toHaveCount(0);
  await expect(page.locator('.land-cmds .land-icon')).not.toHaveCount(0);
  if (info.project.name === 'desktop') {
    const hud = (await page.locator('.land-hud').boundingBox())!, sidebar = (await page.locator('.land-intel').boundingBox())!;
    expect(Math.abs(hud.x - sidebar.width)).toBeLessThan(3);
    await expect(page.locator('.land-own-intel .land-intel-card')).toHaveCount(3);
    await expect(page.getByRole('region',{name:'Comunicaciones del líder',exact:true})).toBeVisible();
    const art = await page.evaluate(async base => {
      const { drawSprite } = await import(base + 'src/features/games/landArt.ts'), { drawWorldProp } = await import(base + 'src/features/games/landProps.ts');
      const c = document.createElement('canvas'); c.width = 800; c.height = 720; const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#142431'; ctx.fillRect(0, 0, c.width, c.height);
      ['humano', 'elfos', 'orcos', 'zergano'].forEach((civ, row) => { for (let i = 0; i < 4; i++) drawSprite(ctx, civ, 1, i * 200 + 100, row * 180 + 175, 163, false, 175, .25 + i * Math.PI / 2); });
      const walking = c.toDataURL('image/png').split(',')[1];
      c.height = 600; ctx.fillStyle = '#142431'; ctx.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < 12; i++) drawWorldProp(ctx, i, i % 4 * 200 + 100, Math.floor(i / 4) * 200 + 194, 180, 190);
      return { walking, props: c.toDataURL('image/png').split(',')[1] };
    }, base);
    writeFileSync(info.outputPath('caminata.png'), Buffer.from(art.walking, 'base64'));
    writeFileSync(info.outputPath('objetos.png'), Buffer.from(art.props, 'base64'));
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: info.outputPath('menu-partida.png') });
  expect(errors).toEqual([]);
});
