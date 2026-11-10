import { expect, test } from '@playwright/test';

test('Factory: menu, gas energy, pause and return', async ({ page }) => {
  const sounds = new Set<string>();
  page.on('requestfinished', request => { const file = request.url().match(/fart-\d+\.mp3/); if (file) sounds.add(file[0]); });
  await page.addInitScript(() => {
    const audit = window as Window & { factoryAudioStarts: number; factoryAudioStops: number; factoryAmbientStarts: number };
    audit.factoryAudioStarts = 0; audit.factoryAudioStops = 0; audit.factoryAmbientStarts = 0;
    const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration?: number) {
      if (this.loop) audit.factoryAmbientStarts++; else audit.factoryAudioStarts++;
      if (duration === undefined) start.call(this, when, offset); else start.call(this, when, offset, duration);
    };
    AudioBufferSourceNode.prototype.stop = function (when = 0) { audit.factoryAudioStops++; stop.call(this, when); };
  });
  await page.goto('/escritorio-personal/#/juegos');
  await expect(page.locator('.games-list > li').last().locator('a')).toHaveAttribute('href', '#/juegos/fabrica');
  await expect(page.locator('a[href="#/juegos/fabrica"] image')).toHaveAttribute('href', /cover\.webp/);
  await page.locator('a[href="#/juegos/fabrica"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('link', { name: 'Salir del juego', exact: true }).click();
  await expect(page.locator('.factory-game')).toHaveCount(0);
  await expect(page.locator('.games-list')).toBeVisible();
  await page.locator('a[href="#/juegos/fabrica"]').click();
  await page.locator('.factory-guide-toggle').click();
  await expect(page.locator('.factory-foods > span')).toHaveCount(10);
  await page.getByRole('button', { name: 'Cerrar alimentos y controles' }).click();
  await page.locator('.factory-primary').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as Window & { factoryAmbientStarts: number }).factoryAmbientStarts)).toBeGreaterThan(0);
  expect(sounds.size).toBe(10);
  const bounds = await page.locator('.factory-stage canvas').boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
  await expect(page.locator('.mobile-nav')).not.toBeVisible();
  await page.keyboard.down('Space');
  await expect.poll(async () => Number(await page.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeLessThan(100);
  await page.keyboard.up('Space');
  await expect.poll(() => page.evaluate(() => (window as Window & { factoryAudioStarts: number }).factoryAudioStarts)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pausa', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const energy = await page.getByRole('progressbar').getAttribute('aria-valuenow');
  await page.waitForTimeout(250);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', energy!);
  expect(await page.evaluate(() => (window as Window & { factoryAudioStops: number }).factoryAudioStops)).toBeGreaterThan(0);
  await page.locator('.factory-primary').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Volver a MiniJuegos' }).click();
  await expect(page.locator('.games-list > li')).toHaveCount(13);
});

test('Factory: losing shows level retry, score and return to the game menu', async ({ page }) => {
  await page.goto('/escritorio-personal/#/juegos/fabrica');
  await page.locator('.factory-primary').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.down('Space'); await page.waitForTimeout(200); await page.keyboard.up('Space');
  await expect(page.getByRole('dialog', { name: 'Fin del intento' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.factory-result-score')).toHaveText(/^Puntos: [1-9]\d*$/);
  await page.getByRole('button', { name: 'Volver a intentar Nivel 1', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.factory-score')).toHaveText('Puntos: 0');
  await expect(page.getByRole('dialog', { name: 'Fin del intento' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Volver al menú principal', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Menú principal' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Salir del juego', exact: true })).toBeVisible();
});
