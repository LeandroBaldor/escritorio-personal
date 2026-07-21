import { expect, test } from '@playwright/test';

test('persiste notas, movimiento, diario y gastos', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await expect(page.getByRole('navigation').getByRole('link')).toHaveText(['Notas']);
  await expect(page.locator('header').getByRole('link', { name: 'Mi diario' })).toHaveCount(0);
  await expect(page.locator('header').getByRole('link', { name: 'Gastos' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Mi diario', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Gastos', exact: true })).toBeVisible();
  await page.getByPlaceholder('¿Qué necesitás recordar?').fill('Pagar luz');
  await page.getByRole('button', { name: 'Rosa' }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Rosa' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/^#/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Agregar nota' }).click();
  await expect(page.locator('.palette')).toHaveCount(0);
  await expect(page.getByText('Mover a', { exact: true })).toHaveCount(0);
  const noteWidth = await page.locator('.note').evaluate(element => element.getBoundingClientRect().width);
  const columnWidth = await page.locator('.column').first().evaluate(element => element.getBoundingClientRect().width);
  expect(noteWidth).toBeLessThanOrEqual(columnWidth * .55);
  await page.getByRole('button', { name: 'Mover a En progreso' }).click();
  await page.getByText('Historial').click();
  await expect(page.getByText('En progreso:', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Texto de nota')).toHaveValue('Pagar luz');
  await expect(page.locator('.note')).toHaveCSS('background-color', 'rgb(247, 183, 195)');
  await page.getByRole('link', { name: 'Mi diario', exact: true }).click();
  page.once('dialog', dialog => dialog.accept('Semana'));
  await page.getByRole('button', { name: 'Nueva carpeta' }).click();
  await page.getByLabel('Página del diario').fill('Algo importante');
  await page.getByRole('link', { name: 'Escritorio Personal' }).click();
  await page.getByRole('link', { name: 'Gastos', exact: true }).click();
  await page.getByPlaceholder('Ej. Electricidad').fill('Electricidad');
  await page.getByPlaceholder('0,00').fill('12,34');
  await page.getByRole('button', { name: 'Agregar' }).click();
  await expect(page.locator('.total strong')).toContainText('12,34');
  await page.reload();
  await expect(page.getByLabel('Concepto')).toHaveValue('Electricidad');
});

test('renombra y borra carpetas de forma segura', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await page.getByRole('link', { name: 'Mi diario', exact: true }).click();
  for (const name of ['Primera', 'Segunda', 'Tercera']) {
    page.once('dialog', dialog => dialog.accept(name));
    await page.getByRole('button', { name: 'Nueva carpeta' }).click();
  }
  await page.getByRole('button', { name: 'Segunda', exact: true }).click();
  await page.getByLabel('Página del diario').fill('Texto que debe conservarse');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1')!).folders.find((folder: { name: string }) => folder.name === 'Segunda'));

  page.once('dialog', dialog => dialog.accept('   '));
  await page.getByRole('button', { name: 'Editar nombre' }).click();
  await expect(page.getByRole('button', { name: 'Segunda', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept('  Semana  '));
  await page.getByRole('button', { name: 'Editar nombre' }).click();
  await expect(page.getByRole('button', { name: 'Semana', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Semana', exact: true }).click();
  await expect(page.getByLabel('Página del diario')).toHaveValue('Texto que debe conservarse');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1')!).folders.find((folder: { name: string }) => folder.name === 'Semana'));
  expect(after.id).toBe(before.id);
  expect(after.pages[0].id).toBe(before.pages[0].id);

  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Borrar carpeta' }).click();
  await expect(page.getByRole('button', { name: 'Semana', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Borrar carpeta' }).click();
  await expect(page.getByText('Tercera · Hoja')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Primera', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Borrar carpeta' }).click();
  await expect(page.getByText('Primera · Hoja')).toBeVisible();
});

test('al borrar la última carpeta muestra el diario vacío', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await page.getByRole('link', { name: 'Mi diario', exact: true }).click();
  page.once('dialog', dialog => dialog.accept('Única'));
  await page.getByRole('button', { name: 'Crear mi primera carpeta' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Borrar carpeta' }).click();
  await expect(page.getByRole('heading', { name: 'Tu diario está listo' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tu diario está listo' })).toBeVisible();
});

test('rechaza backup inválido y restaura uno válido con confirmación', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('versión compatible');
    await dialog.accept();
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  const backup = { version: 1, notes: [{ id: 'n', text: 'Restaurada', color: '#ffe783', status: 'todo', history: [{ status: 'todo', at: '2026-01-01T00:00:00.000Z' }] }], folders: [], expenses: [] };
  await page.locator('input[type=file]').setInputFiles({ name: 'ok.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByRole('dialog', { name: '¿Restaurar esta copia?' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar restauración' }).click();
  await expect(page.getByLabel('Texto de nota')).toHaveValue('Restaurada');
});
