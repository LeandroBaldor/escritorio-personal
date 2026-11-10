import { expect, test } from '@playwright/test';

test('Factory: menu, gas energy, pause and return', async ({ page }) => {
  const sounds = new Set<string>();
  page.on('requestfinished', request => { const file = request.url().match(/fart-\d+\.mp3/); if (file) sounds.add(file[0]); });
  await page.addInitScript(() => {
    const audit = window as Window & { factoryAudioStarts: number; factoryAudioStops: number };
    audit.factoryAudioStarts = 0; audit.factoryAudioStops = 0;
    const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration?: number) {
      audit.factoryAudioStarts++;
      if (duration === undefined) start.call(this, when, offset); else start.call(this, when, offset, duration);
    };
    AudioBufferSourceNode.prototype.stop = function (when = 0) { audit.factoryAudioStops++; stop.call(this, when); };
  });
  await page.goto('/escritorio-personal/#/juegos');
  await expect(page.locator('.games-list > li').last().locator('a')).toHaveAttribute('href', '#/juegos/fabrica');
  await expect(page.locator('a[href="#/juegos/fabrica"] image')).toHaveAttribute('href', /cover\.webp/);
  await page.locator('a[href="#/juegos/fabrica"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('.factory-guide-toggle').click();
  await expect(page.locator('.factory-foods > span')).toHaveCount(10);
  await page.locator('.factory-guide-toggle').click();
  await page.locator('.factory-primary').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
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
  await expect(page.locator('.games-list > li')).toHaveCount(12);
});
