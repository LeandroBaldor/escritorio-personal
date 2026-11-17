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
      for (const t of [2.45, 3.8, 5.5, 6.3, 7.1]) {
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

test('el ovni ejecuta al perdedor antes del resultado final', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const base = project.name === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/';
  await page.goto(`${base}docs/kombat-penales-muertes-preview.html`);
  await page.waitForFunction(() => 'penPreview' in window);
  await page.selectOption('#role', 'finale');
  await page.evaluate(() => (window as unknown as { penPreview: { seek(t: number): void } }).penPreview.seek(2.5));
  for (const t of [1.3, 2.1, 2.45, 4.8]) {
    await page.evaluate(t => (window as unknown as { penPreview: { seek(t: number): void } }).penPreview.seek(t), t);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.locator('canvas').first().screenshot({ path: test.info().outputPath(`ovni-${t}.png`) });
  }
  await page.evaluate(() => (window as unknown as { penPreview: { seek(t: number): void } }).penPreview.seek(2.5));
  const initial = await page.evaluate(() => (window as unknown as { penPreview: { cards: { m: { phase: string; death: { side: number }; winner: number } }[] } }).penPreview.cards.map(c => ({ phase: c.m.phase, victim: c.m.death.side, winner: c.m.winner })));
  expect(initial).toEqual(Array(7).fill({ phase: 'execution', victim: 0, winner: 1 }));
  await page.evaluate(() => (window as unknown as { penPreview: { seek(t: number): void } }).penPreview.seek(20));
  const final = await page.evaluate(() => (window as unknown as { penPreview: { cards: { m: { phase: string; death: { finished: boolean; side: number }; winner: number } }[] } }).penPreview.cards.map(c => ({ phase: c.m.phase, finished: c.m.death.finished, victim: c.m.death.side, winner: c.m.winner })));
  expect(final).toEqual(Array(7).fill({ phase: 'end', finished: true, victim: 0, winner: 1 }));
  expect(errors).toEqual([]);
});

test('los seis sonidos del usuario cargan y se decodifican completos', async ({ page }) => {
  const base = project.name === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/';
  await page.goto(`${base}docs/kombat-penales-muertes-preview.html`);
  const durations = await page.evaluate(async base => {
    const audio = new AudioContext(), durations: number[] = [];
    for (const name of ['cabeza', 'cenizas', 'electricidad', 'congelamiento', 'explosion-jugador', 'explosion-sangre']) { const r = await fetch(`${base}src/features/games/assets/sonidos/pen-${name}.mp3`); if (!r.ok) throw new Error(`No carga ${name}`); const buffer = await audio.decodeAudioData(await r.arrayBuffer()); durations.push(buffer.duration); }
    await audio.close(); return durations;
  }, base);
  expect(durations[0]).toBeCloseTo(5.184, 2); expect(durations[1]).toBeCloseTo(7.008, 2);
  expect(durations).toHaveLength(6); expect(durations.every(t => t > 0)).toBe(true);
});
