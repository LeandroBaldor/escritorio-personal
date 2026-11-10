import { test, expect } from '@playwright/test';

test('Vampyium 2: entrada independiente, controles y pausa', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/escritorio-personal/#/juegos');
  await expect(page.locator('a[href="#/juegos/vampyrium"]')).toBeVisible();
  await page.locator('a[href="#/juegos/vampyium2"]').click();
  await expect(page.getByRole('heading', { name: 'VAMPYIUM 2', exact: true })).toBeVisible();
  await expect(page.locator('.vamp2')).toHaveAttribute('data-realistic-art', 'ready');
  await page.screenshot({ path: `docs/vampyium2-menu-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: /Jugar.*Nivel 1/ }).click();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('vamp-hp')).toHaveText('∞');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(180);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `docs/vampyium2-partida-${testInfo.project.name}.png`, fullPage: true });
  await page.keyboard.press('p');
  await expect(page.getByRole('button', { name: 'Seguir', exact: true }).first()).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('escritorio-personal-juegos:vampyrium-nivel'))).toBeNull();
});

test('todos los enemigos, armas y movimientos se pueden dibujar sin errores', async ({ page }) => {
  await page.goto('/escritorio-personal/#/juegos/vampyium2');
  const result = await page.evaluate(async () => {
    const base = '/escritorio-personal/src/features/games/';
    const logic = await import(/* @vite-ignore */ base + 'vampyium2.ts');
    const art = await import(/* @vite-ignore */ base + 'vampyium2Art.ts');
    const chars = await import(/* @vite-ignore */ base + 'vampyium2Chars.ts');
    const canvas = document.createElement('canvas'); canvas.width = 1400; canvas.height = 900;
    const ctx = canvas.getContext('2d')!;
    let rendered = 0;
    const game = logic.newGame(7, 10);
    for (const kind of ['hunter', ...logic.VAMP_KINDS]) {
      for (const t of [0, .15, .5, 1.2]) {
        ctx.clearRect(0, 0, 1400, 900);
        art.drawPortrait(ctx, kind, game, 600, 700, 100, t); rendered++;
      }
    }
    for (const weapon of logic.WEAPONS) {
      game.weapon = weapon;
      for (const state of ['idle', 'walk', 'jump', 'fall', 'attack', 'hurt', 'land', 'spin', 'dash', 'whirl', 'throw']) {
        const p = logic.newPlayer(); p.onGround = !['jump', 'fall', 'spin'].includes(state);
        p.vx = state === 'walk' ? 7 : 0; p.vy = state === 'jump' ? 10 : state === 'fall' ? -8 : 0;
        p.walkT = .3; p.attackT = state === 'attack' ? .1 : -1; p.attackWeapon = weapon;
        p.hurtT = state === 'hurt' ? .2 : 0; p.landT = state === 'land' ? .15 : 0;
        if (['spin', 'dash', 'whirl', 'throw'].includes(state)) p.special = { kind: state, t: .1, dir: 1, hits: new Set() };
        ctx.save(); ctx.translate(700, 700); ctx.scale(100, 100);
        chars.drawHunterK(ctx, p, game, .3); ctx.restore(); rendered++;
      }
    }
    return rendered;
  });
  expect(result).toBe(172);
});
