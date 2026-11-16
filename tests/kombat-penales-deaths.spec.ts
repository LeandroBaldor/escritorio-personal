import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const project = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('las siete muertes se dibujan para ambos roles y todos los luchadores', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = project.name === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/';
  await page.goto(`${base}docs/kombat-penales-muertes-preview.html`);
  await page.waitForFunction(() => 'penPreview' in window);
  await expect(page.locator('canvas')).toHaveCount(7);
  const chars = await page.locator('#char option').evaluateAll(options => options.map(o => (o as HTMLOptionElement).value));
  for (const role of ['shooter', 'keeper']) {
    await page.selectOption('#role', role);
    for (const char of chars) {
      await page.selectOption('#char', char);
      for (const t of [2.3, 2.9, 3.55, 4.4]) {
        await page.evaluate(t => (window as unknown as { penPreview: { seek(t: number): void } }).penPreview.seek(t), t);
        await page.evaluate(() => new Promise(requestAnimationFrame));
      }
    }
    await page.selectOption('#char', 'frost');
    await page.evaluate(() => (window as unknown as { penPreview: { seek(t: number): void } }).penPreview.seek(2.9));
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.screenshot({ path: test.info().outputPath(`${role}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});
