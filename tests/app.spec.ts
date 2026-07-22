import { expect, test } from '@playwright/test';

test('persiste notas, movimiento, diario y gastos', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.locator('header')).not.toContainText('Notas');
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
  await expect(page.getByText('Pagar luz', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Texto de nota')).toHaveCount(0);
  await expect(page.locator('.note textarea, .note input')).toHaveCount(0);
  const fold = await page.locator('.note').evaluate(element => {
    const style = getComputedStyle(element, '::after');
    return { top: style.top, right: style.right, pointerEvents: style.pointerEvents, borderBottomWidth: style.borderBottomWidth };
  });
  expect(fold).toEqual({ top: '0px', right: '0px', pointerEvents: 'none', borderBottomWidth: '20px' });
  await expect(page.locator('.palette')).toHaveCount(0);
  await expect(page.getByText('Mover a', { exact: true })).toHaveCount(0);
  const noteWidth = await page.locator('.note').evaluate(element => element.getBoundingClientRect().width);
  const columnWidth = await page.locator('.column').first().evaluate(element => element.getBoundingClientRect().width);
  if ((page.viewportSize()?.width ?? 0) <= 480) {
    expect(noteWidth).toBeGreaterThan(columnWidth * .9);
  } else {
    expect(noteWidth).toBeLessThanOrEqual(columnWidth * .55);
  }
  await page.locator('.note-text').evaluate((source, target) => {
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  }, await page.locator('.column').nth(1).elementHandle());
  await page.getByText('Historial').click();
  await expect(page.getByText('En progreso:', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Pagar luz', { exact: true })).toBeVisible();
  await expect(page.locator('.note')).toHaveCSS('background-color', 'rgb(247, 183, 195)');
  await page.getByRole('link', { name: 'Mi diario', exact: true }).click();
  page.once('dialog', dialog => dialog.accept('Semana'));
  await page.getByRole('button', { name: 'Nuevo diario' }).click();
  const journalPage = page.getByLabel('Página del diario');
  await journalPage.fill('Algo importante');
  await expect(journalPage).toBeFocused();
  await expect(journalPage).toHaveCSS('outline-style', 'none');
  await expect(journalPage).toHaveCSS('caret-color', 'rgb(106, 56, 42)');
  await expect(journalPage).toHaveCSS('line-height', '32px');
  const journalFont = await journalPage.evaluate(element => getComputedStyle(element).fontFamily);
  expect(journalFont).toContain('Segoe Print');
  expect(journalFont).toContain('cursive');
  await journalPage.press('Shift+Tab');
  const deleteJournal = page.getByRole('button', { name: 'Borrar diario' });
  await expect(deleteJournal).toBeFocused();
  await expect(deleteJournal).toHaveCSS('outline-style', 'solid');
  await expect(deleteJournal).toHaveCSS('outline-width', '3px');
  await expect(deleteJournal).toHaveCSS('outline-color', 'rgb(244, 189, 88)');
  await page.getByRole('link', { name: 'Escritorio Personal' }).click();
  await page.getByRole('link', { name: 'Gastos', exact: true }).click();
  const today = await page.evaluate(() => { const now = new Date(); return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`; });
  await expect(page.getByLabel('Fecha del gasto', { exact: true })).toHaveValue(today);
  const addCalendar = page.getByLabel('Abrir calendario de fecha del gasto');
  await expect(addCalendar).toBeVisible();
  await page.evaluate(() => {
    (window as typeof window & { calendarOpenCount?: number }).calendarOpenCount = 0;
    HTMLInputElement.prototype.showPicker = function () {
      (window as typeof window & { calendarOpenCount?: number }).calendarOpenCount! += 1;
    };
  });
  const calendarBox = await addCalendar.boundingBox();
  expect(calendarBox).not.toBeNull();
  await page.mouse.click(calendarBox!.x + calendarBox!.width / 2, calendarBox!.y + calendarBox!.height / 2);
  await expect.poll(() => page.evaluate(() => (window as typeof window & { calendarOpenCount?: number }).calendarOpenCount)).toBe(1);
  await page.evaluate(() => {
    const state = window as typeof window & { calendarFallbackCount?: number };
    state.calendarFallbackCount = 0;
    HTMLInputElement.prototype.showPicker = () => { throw new DOMException('Picker unavailable'); };
    document.querySelector<HTMLInputElement>('input[aria-label="Selector de fecha del gasto"]')!.addEventListener('click', () => { state.calendarFallbackCount! += 1; });
  });
  await addCalendar.click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { calendarFallbackCount?: number }).calendarFallbackCount)).toBe(1);
  await page.getByLabel('Fecha del gasto', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(addCalendar).toBeFocused();
  await expect(addCalendar).toHaveCSS('outline-style', 'solid');
  await expect(addCalendar).toHaveCSS('width', '44px');
  await expect(addCalendar).toHaveCSS('height', '44px');
  await expect(addCalendar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Monto del gasto en pesos')).toBeFocused();
  await page.getByLabel('Selector de fecha del gasto').fill('2026-07-23');
  await expect(page.getByLabel('Fecha del gasto', { exact: true })).toHaveValue('23/07/2026');
  const formLabels = page.locator('.calculator form label');
  await expect(formLabels.nth(0)).toContainText('Gasto');
  await expect(formLabels.nth(1)).toContainText('Fecha');
  await expect(formLabels.nth(2)).toContainText('Monto');
  await page.getByPlaceholder('Ej. Electricidad').fill('Electricidad');
  await page.getByPlaceholder('0,00').fill('12,34');
  await page.getByRole('button', { name: 'Agregar' }).click();
  await expect(page.locator('.expense-row .money-input')).toContainText('$');
  await expect(page.getByLabel('Monto en pesos', { exact: true })).toHaveValue('12,34');
  await expect(page.locator('.total strong')).toContainText('12,34');
  await expect(page.locator('.total strong')).toContainText('$');
  await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('23/07/2026');
  const rowCalendar = page.getByLabel('Abrir calendario de fecha', { exact: true });
  await expect(rowCalendar).toBeVisible();
  await page.getByLabel('Fecha', { exact: true }).fill('31/02/2026');
  await page.getByLabel('Fecha', { exact: true }).blur();
  await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('31/02/2026');
  await expect(page.getByText('Concepto, fecha o monto inválido.', { exact: true })).toBeVisible();
  let storedExpense = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!).expenses.find((expense: { concept: string }) => expense.concept === 'Electricidad'));
  expect(storedExpense.date).toBe('2026-07-23');
  await rowCalendar.click();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('31/02/2026');
  storedExpense = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!).expenses.find((expense: { concept: string }) => expense.concept === 'Electricidad'));
  expect(storedExpense.date).toBe('2026-07-23');
  await page.getByLabel('Selector de fecha', { exact: true }).fill('2026-07-21');
  await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('21/07/2026');
  storedExpense = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!).expenses.find((expense: { concept: string }) => expense.concept === 'Electricidad'));
  expect(storedExpense.date).toBe('2026-07-21');
  await page.getByLabel('Monto en pesos', { exact: true }).fill('15.5');
  await page.getByLabel('Monto en pesos', { exact: true }).blur();
  await expect(page.getByLabel('Monto en pesos', { exact: true })).toHaveValue('15,50');
  await page.reload();
  await expect(page.getByLabel('Concepto')).toHaveValue('Electricidad');
  await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('21/07/2026');
  storedExpense = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!).expenses.find((expense: { concept: string }) => expense.concept === 'Electricidad'));
  expect(storedExpense.date).toBe('2026-07-21');
  await expect(page.getByLabel('Monto en pesos', { exact: true })).toHaveValue('15,50');
});

test('mantiene vacía la fecha de un gasto legacy al editar otro campo', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await page.evaluate(() => localStorage.setItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001', JSON.stringify({ version: 1, notes: [], folders: [], expenses: [{ id: 'legacy', concept: 'Gasto anterior', cents: 1234 }] })));
  await page.reload();
  await page.getByRole('link', { name: 'Gastos', exact: true }).click();
  await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Abrir calendario de fecha', { exact: true })).toBeVisible();
  await page.getByLabel('Concepto').fill('Gasto actualizado');
  await page.getByLabel('Concepto').blur();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!).expenses[0]);
  expect(stored).toEqual({ id: 'legacy', concept: 'Gasto actualizado', cents: 1234 });
});

test('renombra y borra carpetas de forma segura', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await page.getByRole('link', { name: 'Mi diario', exact: true }).click();
  for (const name of ['Primera', 'Segunda', 'Tercera']) {
    page.once('dialog', dialog => dialog.accept(name));
    await page.getByRole('button', { name: 'Nuevo diario' }).click();
  }
  await page.getByRole('button', { name: 'Segunda', exact: true }).click();
  await page.getByLabel('Página del diario').fill('Texto que debe conservarse');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!).folders.find((folder: { name: string }) => folder.name === 'Segunda'));

  page.once('dialog', dialog => dialog.accept('   '));
  await page.getByRole('button', { name: 'Editar nombre' }).click();
  await expect(page.getByRole('button', { name: 'Segunda', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept('  Semana  '));
  await page.getByRole('button', { name: 'Editar nombre' }).click();
  await expect(page.getByRole('button', { name: 'Semana', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Semana', exact: true }).click();
  await expect(page.getByLabel('Página del diario')).toHaveValue('Texto que debe conservarse');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!).folders.find((folder: { name: string }) => folder.name === 'Semana'));
  expect(after.id).toBe(before.id);
  expect(after.pages[0].id).toBe(before.pages[0].id);

  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Borrar diario' }).click();
  await expect(page.getByRole('button', { name: 'Semana', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Borrar diario' }).click();
  await expect(page.getByText('Tercera · Hoja')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Primera', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Borrar diario' }).click();
  await expect(page.getByText('Primera · Hoja')).toBeVisible();
});

test('al borrar la última carpeta muestra el diario vacío', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await page.getByRole('link', { name: 'Mi diario', exact: true }).click();
  page.once('dialog', dialog => dialog.accept('Única'));
  await page.getByRole('button', { name: 'Crear mi primera carpeta' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Borrar diario' }).click();
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
  const backup = { version: 1, notes: [{ id: 'n', text: 'Restaurada\nSegunda línea', color: '#ffe783', status: 'todo', history: [{ status: 'todo', at: '2026-01-01T00:00:00.000Z' }] }], folders: [], expenses: [] };
  await page.locator('input[type=file]').setInputFiles({ name: 'ok.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByRole('dialog', { name: '¿Restaurar esta copia?' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar restauración' }).click();
  await expect(page.locator('.note-text')).toHaveText('Restaurada\nSegunda línea');
  await expect(page.locator('.note textarea, .note input')).toHaveCount(0);
});

test('conserva texto multilínea y permite mover solo arrastrando la tarjeta', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await page.getByPlaceholder('¿Qué necesitás recordar?').fill('Primera línea\nSegunda línea');
  await page.getByRole('button', { name: 'Agregar nota' }).click();
  const note = page.locator('.note');
  await expect(note.locator('.note-text')).toHaveCSS('white-space', 'pre-wrap');
  await expect(note.locator('.note-text')).toContainText('Primera línea\nSegunda línea');
  await note.getByText('Historial').click();
  await expect(note.locator('details')).toHaveAttribute('open', '');
  await expect(page.locator('.column').first().locator('.note')).toHaveCount(1);
  const blockedDrag = await note.evaluate(element => {
    element.querySelector('summary')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const drag = new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
    return !element.dispatchEvent(drag);
  });
  expect(blockedDrag).toBe(true);
  await expect(note).toHaveAttribute('draggable', 'true');
  await expect(note.locator('.note-actions, .note-order-actions')).toHaveCount(0);
  await expect(note.getByRole('button')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.note-text')).toContainText('Primera línea\nSegunda línea');
});

test('reordena libremente, persiste y registra historial solo al cambiar de sección', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await page.evaluate(() => {
    const at = '2026-01-01T00:00:00.000Z';
    localStorage.setItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001', JSON.stringify({ version: 1, notes: [
      { id: 'a', text: 'Nota A', color: '#ffe783', status: 'todo', history: [{ status: 'todo', at }] },
      { id: 'b', text: 'Nota B', color: '#f7b7c3', status: 'todo', history: [{ status: 'todo', at }] },
      { id: 'c', text: 'Nota C', color: '#bde7c6', status: 'todo', history: [{ status: 'todo', at }] },
      { id: 'd', text: 'Nota D', color: '#bcdcf6', status: 'doing', history: [{ status: 'doing', at }] },
    ], folders: [], expenses: [] }));
  });
  await page.reload();
  const texts = (column: number) => page.locator('.column').nth(column).locator('.note-text').allTextContents();
  const dragTo = async (sourceId: string, targetId: string, columnIndex: number, position: 'before' | 'after' = 'before') => {
    const column = page.locator('.column').nth(columnIndex);
    await column.evaluate((targetColumn, { sourceId, targetId, position }) => {
      const source = document.querySelector<HTMLElement>(`.note[data-note-id="${sourceId}"]`)!;
      const target = document.querySelector<HTMLElement>(`.note[data-note-id="${targetId}"]`)!;
      const rect = target.getBoundingClientRect();
      const clientX = position === 'before' ? rect.left + 2 : rect.right - 2;
      const clientY = position === 'before' ? rect.top + 2 : rect.bottom - 2;
      const transfer = new DataTransfer();
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      targetColumn.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer: transfer }));
      targetColumn.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer: transfer }));
      source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
    }, { sourceId, targetId, position });
  };

  await dragTo('a', 'c', 0, 'after');
  await expect.poll(() => texts(0)).toEqual(['Nota B', 'Nota C', 'Nota A']);
  await dragTo('c', 'b', 0);
  await expect.poll(() => texts(0)).toEqual(['Nota C', 'Nota B', 'Nota A']);
  await dragTo('b', 'c', 0);
  await dragTo('a', 'c', 0);
  await expect.poll(() => texts(0)).toEqual(['Nota B', 'Nota A', 'Nota C']);
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!));
  expect(stored.notes.find((note: { id: string }) => note.id === 'b').history).toHaveLength(1);
  await page.reload();
  await expect.poll(() => texts(0)).toEqual(['Nota B', 'Nota A', 'Nota C']);

  await dragTo('c', 'd', 1);
  await expect.poll(() => texts(1)).toEqual(['Nota C', 'Nota D']);
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!));
  const moved = stored.notes.find((note: { id: string }) => note.id === 'c');
  expect(moved.status).toBe('doing');
  expect(moved.history).toHaveLength(2);

  await expect(page.locator('.note-actions, .note-order-actions')).toHaveCount(0);
  await expect(page.locator('.note[data-note-id="d"]')).toHaveAttribute('draggable', 'true');
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!));
  expect(stored.notes.find((note: { id: string }) => note.id === 'd').history).toHaveLength(1);
});
