import { expect, test } from '@playwright/test';

test('Factory: menu, gas energy, pause and return', async ({ page }) => {
  await page.goto('/escritorio-personal/#/juegos');
  await page.locator('a[href="#/juegos/fabrica"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('.factory-primary').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.down('Space');
  await expect.poll(async () => Number(await page.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeLessThan(100);
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'Pausa', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const energy = await page.getByRole('progressbar').getAttribute('aria-valuenow');
  await page.waitForTimeout(250);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', energy!);
  await page.locator('.factory-primary').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Volver a MiniJuegos' }).click();
  await expect(page.locator('.games-list > li')).toHaveCount(11);
});
