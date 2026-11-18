import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const project = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('el nuevo árbitro apunta y dispara plasma verde a ambos roles', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const base = project.name === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/';
  await page.goto(`${base}docs/kombat-penales-muertes-preview.html`);
  await page.waitForFunction(() => 'penPreview' in window);
  await page.evaluate(() => (window as unknown as { penPreview: { cards: unknown[] } }).penPreview.cards.splice(1));
  const assets = await page.evaluate(async base => {
    const result = [];
    for (const n of [1, 2]) {
      const image = new Image(); image.src = `${base}src/features/games/assets/penales/arbitro-nuevo-${n}.png`; await image.decode();
      const c = document.createElement('canvas'); c.width = image.naturalWidth; c.height = image.naturalHeight;
      const ctx = c.getContext('2d')!; ctx.drawImage(image, 0, 0);
      result.push({ w: c.width, h: c.height, corner: ctx.getImageData(0, 0, 1, 1).data[3] });
    }
    return result;
  }, base);
  expect(assets).toEqual(Array(2).fill({ w: 1199, h: 1312, corner: 0 }));
  for (const role of ['shooter', 'keeper']) {
    await page.selectOption('#role', role);
    let idleGreen = 0;
    for (const t of [1.4, 1.86, 1.98]) {
      await page.evaluate(t => (window as unknown as { penPreview: { seek(t: number): void } }).penPreview.seek(t), t);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      if (t === 1.4 || t === 1.86) {
        const green = await page.locator('canvas').first().evaluate(canvas => {
          const c = canvas as HTMLCanvasElement, pixels = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
          let count = 0;
          for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 1] > 200 && pixels[i + 1] > pixels[i] * 1.25 && pixels[i + 1] > pixels[i + 2] * 1.5) count++;
          return count;
        });
        if (t === 1.4) idleGreen = green;
        else expect(green).toBeGreaterThan(idleGreen + 300);
      }
      await page.locator('canvas').first().screenshot({ path: test.info().outputPath(`ref-${role}-${t}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
