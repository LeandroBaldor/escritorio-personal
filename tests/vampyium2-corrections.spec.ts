import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('práctica: construcción, diez niveles, vida ilimitada y carteles', async ({ page }, testInfo) => {
  await page.goto('/escritorio-personal/#/juegos/vampyium2');
  await expect(page.locator('.vamp2')).toHaveAttribute('data-realistic-art', 'ready');
  await expect(page.getByText('En construcción', { exact: true })).toHaveCount(0);
  const levels = page.getByRole('group', { name: 'Elegir nivel' }).getByRole('button');
  await expect(levels).toHaveCount(10);
  for (const button of await levels.all()) await expect(button).toBeEnabled();
  await levels.last().click();
  await page.getByRole('button', { name: /Jugar.*Nivel 10/ }).click(); await page.keyboard.press('Enter');
  await expect(page.getByTestId('vamp-hp')).toHaveText('∞');
  await page.keyboard.press('p');
  await page.getByRole('dialog').getByRole('button', { name: 'Volver al Menú' }).click();
  await levels.first().click(); await page.getByRole('button', { name: /Jugar.*Nivel 1$/ }).click(); await page.keyboard.press('Enter');
  // Cross the first gap without jumping: immortal mode must preserve real HP after the fall.
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(950); await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(2200);
  await expect(page.getByTestId('vamp-hp')).toHaveAttribute('data-current-hp', '100');
  await page.keyboard.press('p');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button')).toHaveCount(2);
  await page.screenshot({ path: `docs/vampyium2-pause-${testInfo.project.name}.png`, fullPage: true });
  await page.evaluate(async () => {
    const base = '/escritorio-personal/';
    const React = await import(/* @vite-ignore */ base + 'node_modules/.vite/deps/react.js');
    const ReactDOM = await import(/* @vite-ignore */ base + 'node_modules/.vite/deps/react-dom_client.js');
    const { Vampyium2Decision } = await import(/* @vite-ignore */ base + 'src/features/games/Vampyium2Decision.tsx');
    const old = document.querySelector<HTMLElement>('.vamp-overlay')!;
    old.style.display = 'none'; old.querySelector('#vamp-message')?.removeAttribute('id');
    const host = document.createElement('div'); host.className = 'runner-overlay vamp-overlay'; host.setAttribute('role', 'dialog'); host.setAttribute('aria-labelledby', 'vamp-message');
    const panel = document.createElement('div'); panel.className = 'trepa-overlay-card ds-frame vamp-decision-frame'; host.append(panel);
    document.querySelector('.vamp2 .runner-stage')!.append(host);
    const react = React.default ?? React, client = ReactDOM.default ?? ReactDOM;
    client.createRoot(panel).render(react.createElement(Vampyium2Decision, { defeated: true,
      onRetry: () => { document.documentElement.dataset.vampRetry = 'clicked'; },
      onMenu: () => { document.documentElement.dataset.vampMenu = 'clicked'; }, onContinue: () => {} }));
  });
  const defeat = page.getByRole('dialog', { name: 'Fin del intento' });
  await expect(defeat.getByRole('button', { name: 'Volver a intentar', exact: true })).toBeVisible();
  const retry = (await defeat.getByRole('button', { name: 'Volver a intentar' }).boundingBox())!;
  const menu = (await defeat.getByRole('button', { name: 'Volver al Menú' }).boundingBox())!;
  expect(retry.y + retry.height).toBeLessThan(menu.y);
  await page.screenshot({ path: `docs/vampyium2-defeat-${testInfo.project.name}.png`, fullPage: true });
  await defeat.getByRole('button', { name: 'Volver a intentar' }).click(); await defeat.getByRole('button', { name: 'Volver al Menú' }).click();
  expect(await page.evaluate(() => [document.documentElement.dataset.vampRetry, document.documentElement.dataset.vampMenu])).toEqual(['clicked', 'clicked']);
});

test('la caminata articula piernas y brazos en 24 fases conservando el diseño', async ({ page }, testInfo) => {
  await page.goto('/escritorio-personal/#/juegos/vampyium2');
  const result = await page.evaluate(async () => {
    const base = '/escritorio-personal/src/features/games/';
    const art = await import(/* @vite-ignore */ base + 'vampyium2Sprites.ts');
    const logic = await import(/* @vite-ignore */ base + 'vampyium2.ts');
    const motion = await import(/* @vite-ignore */ base + 'vampyium2Motion.ts');
    await art.waitForRealisticArt();
    const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 340;
    const c = canvas.getContext('2d', { willReadFrequently: true })!;
    const sheet = document.createElement('canvas'); sheet.width = 1200; sheet.height = 1020; const sc = sheet.getContext('2d')!;
    sc.fillStyle = '#121b24'; sc.fillRect(0, 0, sheet.width, sheet.height);
    const g = logic.newGame(7, 1), counts = [];
    for (const kind of ['walker', 'giant', 'mage', 'hammer', 'warrior', 'wolf', 'dracula']) {
      const hashes = new Set();
      for (let phase = 0; phase < 24; phase++) {
        c.clearRect(0, 0, 300, 340);
        const distance = phase / 24 * (.88 * motion.VAMP_VISUAL_SCALE) * logic.BODY[kind].k * motion.VAMP_STEP_LENGTH / motion.VAMP_STANCE;
        const v = logic.makeVamp(g, kind, { onGround: true, state: 'walk', vx: 2, walkT: distance });
        c.save(); c.translate(150, 320); c.scale(132, 132); art.drawRealisticEnemy(c, v, phase / 24); c.restore();
        const pixels = c.getImageData(0, 110, 300, 230).data;
        let hash = 2166136261; for (let i = 0; i < pixels.length; i += 4) hash = Math.imul(hash ^ (pixels[i] + pixels[i + 1] * 3 + pixels[i + 3] * 7), 16777619);
        hashes.add(hash);
        if (kind === 'walker' && phase % 2 === 0) sc.drawImage(canvas, (phase / 2 % 4) * 300, Math.floor(phase / 8) * 340);
      }
      counts.push({ kind, poses: hashes.size });
    }
    return { counts, sheet: sheet.toDataURL('image/png').split(',')[1] };
  });
  for (const entry of result.counts) expect(entry.poses, entry.kind).toBeGreaterThanOrEqual(20);
  if (testInfo.project.name === 'desktop') fs.writeFileSync('docs/vampyium2-walk-cycle.png', Buffer.from(result.sheet, 'base64'));
});
