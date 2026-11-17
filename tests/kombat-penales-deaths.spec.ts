import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const project = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('la pierna gigante llega al piso y su recorte no tapa la cancha con un fondo', async ({ page }) => {
  test.setTimeout(90_000); // Seis capturas de alta resolución en los runners compartidos.
  const base = project.name === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/';
  await page.goto(`${base}docs/kombat-penales-muertes-preview.html`);
  await page.waitForFunction(() => 'penPreview' in window);
  // El recorrido de todos los luchadores se prueba aparte; aquí se renderiza sólo el pisotón.
  await page.evaluate(() => (window as unknown as { penPreview: { cards: unknown[] } }).penPreview.cards.splice(0, 7));
  const alpha = await page.evaluate(async base => {
    const image = new Image(); image.src = `${base}src/features/games/assets/penales/botines-cutout.png`; await image.decode();
    const c = document.createElement('canvas'); c.width = image.naturalWidth; c.height = image.naturalHeight;
    const ctx = c.getContext('2d')!; ctx.drawImage(image, 0, 0);
    return [[0, 0], [0, 700], [1023, 700], [600, 700]].map(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3]);
  }, base);
  expect(alpha.slice(0, 3)).toEqual([0, 0, 0]); expect(alpha[3]).toBeGreaterThanOrEqual(250);
  for (const role of ['shooter', 'keeper']) {
    await page.selectOption('#role', role);
    for (const t of [3.8, 4.7, 5.4]) {
      await page.evaluate(t => (window as unknown as { penPreview: { seek(t: number): void } }).penPreview.seek(t), t);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await page.locator('canvas').nth(7).screenshot({ path: test.info().outputPath(`stomp-${role}-${t}.png`) });
    }
  }
});

test('el casco del ovni permanece opaco incluso al retirarse', async ({ page }) => {
  const base = project.name === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/';
  await page.goto(`${base}docs/kombat-penales-muertes-preview.html`);
  await page.waitForFunction(() => 'penPreview' in window);
  const alpha = await page.evaluate(async base => {
    const url = `${base}src/features/games/kombatPenUfo.ts`;
    const { drawPenUfo, ufoSequence, UFO_WIDTH } = await import(/* @vite-ignore */ url);
    const image = new Image(); image.src = `${base}src/features/games/assets/penales/ovni.png`; await image.decode();
    await new Promise(resolve => setTimeout(resolve, 100));
    const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    const result: number[] = [];
    for (const t of [1.3, 4.6]) {
      ctx.clearRect(0, 0, 1536, 1024);
      const seq = ufoSequence(t), h = 1536 / UFO_WIDTH;
      const x = 768 - (1 - seq.enter) * 650 - seq.leave * 500;
      const y = 512 + h * 2.15 + (1 - seq.enter) * 650 + seq.leave * 750 - Math.sin(t * 3.5) * 9;
      drawPenUfo(ctx, t, { x, y, h });
      for (const [px, py] of [[768, 760], [768, 800], [1100, 690]]) result.push(ctx.getImageData(px, py, 1, 1).data[3]);
    }
    return result;
  }, base);
  expect(alpha).toEqual(Array(6).fill(255));
});

test('las ocho muertes se dibujan para ambos roles y todos los luchadores', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = project.name === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/';
  await page.goto(`${base}docs/kombat-penales-muertes-preview.html`);
  await page.waitForFunction(() => 'penPreview' in window);
  await expect(page.locator('canvas')).toHaveCount(8);
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
  expect(initial).toEqual(Array(8).fill({ phase: 'execution', victim: 0, winner: 1 }));
  await page.evaluate(() => (window as unknown as { penPreview: { seek(t: number): void } }).penPreview.seek(20));
  const final = await page.evaluate(() => (window as unknown as { penPreview: { cards: { m: { phase: string; death: { finished: boolean; side: number }; winner: number } }[] } }).penPreview.cards.map(c => ({ phase: c.m.phase, finished: c.m.death.finished, victim: c.m.death.side, winner: c.m.winner })));
  expect(final).toEqual(Array(8).fill({ phase: 'end', finished: true, victim: 0, winner: 1 }));
  expect(errors).toEqual([]);
});

test('los diez sonidos del usuario cargan y se decodifican completos', async ({ page }) => {
  const base = project.name === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/';
  await page.goto(`${base}docs/kombat-penales-muertes-preview.html`);
  const durations = await page.evaluate(async base => {
    const audio = new AudioContext(), durations: number[] = [];
    for (const name of ['cabeza', 'cenizas', 'electricidad', 'congelamiento', 'explosion-jugador', 'explosion-sangre', 'ovni', 'ovni-dispara', 'fuegos-artificiales', 'paso-gigante']) { const r = await fetch(`${base}src/features/games/assets/sonidos/pen-${name}.mp3`); if (!r.ok) throw new Error(`No carga ${name}`); const buffer = await audio.decodeAudioData(await r.arrayBuffer()); durations.push(buffer.duration); }
    await audio.close(); return durations;
  }, base);
  expect(durations[0]).toBeCloseTo(5.184, 2); expect(durations[1]).toBeCloseTo(7.008, 2);
  expect(durations).toHaveLength(10); expect(durations.every(t => t > 0)).toBe(true);
});
