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
      for (const t of [2.35, 2.9, 4.4, 7.1, 9.4]) {
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

test('la muerte del perdedor completa las siete variantes antes del resultado final', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const base = project.name === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/';
  await page.goto(`${base}docs/kombat-penales-muertes-preview.html`);
  await page.waitForFunction(() => 'penPreview' in window);
  await page.selectOption('#role', 'finale');
  await page.evaluate(() => (window as unknown as { penPreview: { seek(t: number): void } }).penPreview.seek(1.2));
  const initial = await page.evaluate(() => (window as unknown as { penPreview: { cards: { m: { phase: string; death: { side: number }; winner: number } }[] } }).penPreview.cards.map(c => ({ phase: c.m.phase, victim: c.m.death.side, winner: c.m.winner })));
  expect(initial).toEqual(Array(7).fill({ phase: 'execution', victim: 0, winner: 1 }));
  await page.evaluate(() => (window as unknown as { penPreview: { seek(t: number): void } }).penPreview.seek(20));
  const final = await page.evaluate(() => (window as unknown as { penPreview: { cards: { m: { phase: string; death: { finished: boolean; side: number }; winner: number } }[] } }).penPreview.cards.map(c => ({ phase: c.m.phase, finished: c.m.death.finished, victim: c.m.death.side, winner: c.m.winner })));
  expect(final).toEqual(Array(7).fill({ phase: 'end', finished: true, victim: 0, winner: 1 }));
  expect(errors).toEqual([]);
});

test('los dos sonidos del usuario cargan y se decodifican completos', async ({ page }) => {
  const base = project.name === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/';
  await page.goto(`${base}docs/kombat-penales-muertes-preview.html`);
  const durations = await page.evaluate(async base => {
    const audio = new AudioContext(), durations: number[] = [];
    for (const name of ['cabeza', 'cenizas']) { const r = await fetch(`${base}src/features/games/assets/sonidos/pen-${name}.mp3`); if (!r.ok) throw new Error(`No carga ${name}`); const buffer = await audio.decodeAudioData(await r.arrayBuffer()); durations.push(buffer.duration); }
    await audio.close(); return durations;
  }, base);
  expect(durations[0]).toBeCloseTo(5.184, 2); expect(durations[1]).toBeCloseTo(7.008, 2);
});
