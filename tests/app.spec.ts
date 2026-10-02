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
  const rootFontSize = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  await expect(journalPage).toHaveCSS('line-height', `${rootFontSize * 2}px`);
  const journalFont = await journalPage.evaluate(element => getComputedStyle(element).fontFamily);
  expect(journalFont).toContain('Segoe Print');
  expect(journalFont).toContain('cursive');
  await journalPage.press('Shift+Tab');
  const greenButton = page.getByRole('button', { name: 'Verde' });
  await expect(greenButton).toBeFocused();
  await expect(greenButton).toHaveCSS('outline-style', 'solid');
  await expect(greenButton).toHaveCSS('outline-width', '3px');
  await expect(greenButton).toHaveCSS('outline-color', 'rgb(244, 189, 88)');
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
  await addCalendar.click();
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
  await expect(formLabels.nth(1)).toContainText('Categoría');
  await expect(formLabels.nth(2)).toContainText('Fecha');
  await expect(formLabels.nth(3)).toContainText('Monto');
  await expect(formLabels.nth(4)).toContainText('Pagado');
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
  const rowPaidSelect = page.getByLabel('Estado de pago', { exact: true });
  await expect(rowPaidSelect).toHaveValue('unpaid');
  await expect(rowPaidSelect).toHaveCSS('background-color', 'rgb(142, 60, 51)');
  await expect(rowPaidSelect).toHaveCSS('color', 'rgb(255, 255, 255)');
  await rowPaidSelect.selectOption('paid');
  await expect(rowPaidSelect).toHaveCSS('background-color', 'rgb(189, 231, 198)');
  await expect(rowPaidSelect).toHaveCSS('color', 'rgb(51, 35, 23)');
  storedExpense = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!).expenses.find((expense: { concept: string }) => expense.concept === 'Electricidad'));
  expect(storedExpense.paid).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Concepto')).toHaveValue('Electricidad');
  await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('21/07/2026');
  storedExpense = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!).expenses.find((expense: { concept: string }) => expense.concept === 'Electricidad'));
  expect(storedExpense.date).toBe('2026-07-21');
  await expect(page.getByLabel('Monto en pesos', { exact: true })).toHaveValue('15,50');
  await expect(page.getByLabel('Estado de pago', { exact: true })).toHaveValue('paid');
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
  await expect(page.getByLabel('Página del diario')).toHaveText('Texto que debe conservarse');
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
  await expect(note.getByRole('button')).toHaveText(['Borrar', 'Editar']);
  await page.reload();
  await expect(page.locator('.note-text')).toContainText('Primera línea\nSegunda línea');
});

test('guarda una nota en el disquete conservando el historial y permite restaurarla o borrarla', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await expect(page.getByRole('link', { name: 'Notas guardadas', exact: false })).toBeVisible();
  await page.evaluate(() => {
    const at = '2026-01-01T00:00:00.000Z';
    localStorage.setItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001', JSON.stringify({ version: 1, notes: [
      { id: 'a', text: 'Nota A', color: '#ffe783', status: 'doing', history: [{ status: 'todo', at }, { status: 'doing', at }] },
    ], folders: [], expenses: [] }));
  });
  await page.reload();
  await page.locator('.note-text').evaluate((source, target) => {
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, await page.locator('.floppy').elementHandle());
  await expect(page.locator('.note')).toHaveCount(0);
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!));
  expect(stored.notes[0].archivedAt).toBeTruthy();
  expect(stored.notes[0].history).toHaveLength(2);

  await page.getByRole('link', { name: 'Notas guardadas', exact: false }).click();
  await expect(page.getByText('Nota A', { exact: true })).toBeVisible();
  await page.getByText('Historial').click();
  await expect(page.getByText('En progreso:', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByRole('heading', { name: 'Todavía no guardaste ninguna nota' })).toBeVisible();
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!));
  expect(stored.notes[0].archivedAt).toBeUndefined();
  expect(stored.notes[0].status).toBe('doing');

  await page.getByRole('link', { name: 'Escritorio Personal' }).click();
  await expect(page.locator('.note-text')).toHaveText('Nota A');
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

test('carga meses, guarda gastos en su carpeta y los saca de la lista', async ({ page }) => {
  page.on('dialog', dialog => dialog.type() === 'prompt' ? dialog.accept('09/2026') : dialog.accept());
  await page.goto('/escritorio-personal/');
  await page.getByRole('link', { name: 'Gastos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cerrar mes' })).toHaveCount(0);
  await page.getByLabel('Cargar mes').fill('13/2026');
  await page.getByRole('button', { name: 'Crear carpeta' }).click();
  await expect(page.locator('.calculator').getByRole('alert')).toContainText('mm/aaaa');
  await page.getByLabel('Cargar mes').fill('8/2026');
  await page.getByRole('button', { name: 'Crear carpeta' }).click();
  await expect(page.getByText('Carpeta 08/2026 creada en el disquete.')).toBeVisible();
  await page.getByLabel('Cargar mes').fill('07/2026');
  await page.getByLabel('Cargar mes').press('Enter');
  await page.getByLabel('Cargar mes').fill('08/2026');
  await page.getByRole('button', { name: 'Crear carpeta' }).click();
  await expect(page.getByText('La carpeta 08/2026 ya existe.')).toBeVisible();
  for (const [concept, amount, category] of [['Luz', '1500', 'Casa'], ['Farmacia', '200,50', 'Médicos'], ['Gas', '900', 'Casa']]) {
    await page.getByPlaceholder('Ej. Electricidad').fill(concept);
    await page.getByLabel('Categoría del gasto').selectOption(category);
    await page.getByPlaceholder('0,00').fill(amount);
    await page.getByRole('button', { name: 'Agregar' }).click();
  }
  const rows = page.locator('.expense-row');
  await expect(rows.nth(0).getByLabel('Carpeta del mes').locator('option')).toHaveText(['Elegí el mes', '07/2026', '08/2026']);
  await rows.nth(0).getByRole('button', { name: 'Guardar' }).click();
  await expect(rows.nth(0).getByRole('alert')).toContainText('Elegí la carpeta');
  await rows.nth(0).getByLabel('Carpeta del mes').selectOption({ label: '08/2026' });
  await rows.nth(0).getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('“Luz” se guardó en 08/2026.')).toBeVisible();
  await expect(rows).toHaveCount(2);
  await expect(page.getByLabel('Concepto').first()).toHaveValue('Farmacia');
  await rows.nth(0).getByLabel('Carpeta del mes').selectOption({ label: '08/2026' });
  await rows.nth(0).getByRole('button', { name: 'Guardar' }).click();
  await expect(rows).toHaveCount(1);
  await expect(page.locator('.total strong')).toContainText('900,00');
  await page.getByRole('link', { name: 'Meses guardados' }).click();
  await expect(page.locator('.month-folder-open strong')).toHaveText(['07/2026', '08/2026']);
  await page.getByRole('button', { name: 'Abrir 08/2026' }).click();
  const lines = page.locator('.ledger ol > li');
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toContainText('Luz / Casa /');
  await expect(lines.nth(0)).toContainText('$\u00a01.500,00 / No pagado');
  await expect(lines.nth(1)).toContainText('Farmacia / Médicos /');
  await expect(page.locator('.ledger-total')).toContainText('$\u00a01.700,50');
  await page.getByRole('button', { name: 'Editar Luz' }).click();
  const form = page.getByRole('form', { name: 'Editar Luz' });
  await form.getByLabel('Gasto').fill('Electricidad');
  await form.getByLabel('Categoría').selectOption('Gastos mensuales');
  await form.getByLabel('Monto en pesos').fill('abc');
  await form.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(form.getByRole('alert')).toBeVisible();
  await form.getByLabel('Monto en pesos').fill('1800');
  await form.getByLabel('Estado de pago').selectOption('paid');
  await form.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(lines.nth(0)).toContainText('Electricidad / Gastos mensuales /');
  await expect(lines.nth(0)).toContainText('$\u00a01.800,00 / Pagado');
  await page.getByRole('button', { name: 'Editar Farmacia' }).click();
  await page.getByRole('form', { name: 'Editar Farmacia' }).getByLabel('Gasto').fill('Otra cosa');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(lines.nth(1)).toContainText('Farmacia / Médicos /');
  await page.getByRole('button', { name: 'Borrar Farmacia' }).click();
  await expect(lines).toHaveCount(1);
  await expect(page.locator('.ledger-total')).toContainText('$\u00a01.800,00');
  await page.reload();
  await page.getByRole('button', { name: 'Abrir 08/2026' }).click();
  await expect(lines).toHaveCount(1);
  await page.getByRole('button', { name: 'Editar nombre' }).click();
  await expect(page.locator('.ledger h2')).toHaveText('09/2026');
  await page.getByRole('button', { name: 'Borrar carpeta' }).click();
  await expect(page.locator('.month-folder-open strong')).toHaveText(['07/2026']);
});

test('edita el texto de una nota desde su tarjeta', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await page.getByPlaceholder('¿Qué necesitás recordar?').fill('Pagar luz');
  await page.getByRole('button', { name: 'Agregar nota' }).click();
  const note = page.locator('.note').first();
  await note.getByRole('button', { name: 'Editar' }).click();
  await note.getByLabel('Texto de la nota').fill('   ');
  await expect(note.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  await note.getByLabel('Texto de la nota').fill('Pagar gas');
  await note.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('.note-text')).toHaveText('Pagar luz');
  await note.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Texto de la nota').fill('Pagar luz y gas');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.note-text')).toHaveText('Pagar luz y gas');
  await page.reload();
  await expect(page.locator('.note-text')).toHaveText('Pagar luz y gas');
});

test('organiza las notas guardadas en carpetas arrastrándolas', async ({ page }) => {
  page.on('dialog', dialog => dialog.type() === 'prompt' ? dialog.accept('Turnos médicos') : dialog.accept());
  await page.goto('/escritorio-personal/');
  await page.evaluate(() => {
    const at = '2026-01-01T00:00:00.000Z';
    const note = (id: string, text: string) => ({ id, text, color: '#bcdcf6', status: 'todo', history: [{ status: 'todo', at }], archivedAt: at });
    localStorage.setItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001', JSON.stringify({ version: 1, notes: [
      note('a', 'Turno Alteman miércoles 10 hs'), note('b', 'Resultados de sangre'),
    ], folders: [], expenses: [] }));
  });
  await page.reload();
  await page.getByRole('link', { name: 'Notas guardadas', exact: false }).click();
  await expect(page.getByText('Turno Alteman miércoles 10 hs', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Mover “Resultados de sangre” a una carpeta')).toHaveCount(0);
  await page.getByLabel('Nombre de la nueva carpeta').fill('Turnos');
  await page.getByRole('button', { name: 'Crear carpeta' }).click();
  await expect(page.getByRole('button', { name: 'Carpeta Turnos, 0 notas' })).toBeVisible();
  const card = page.locator('.saved-note').filter({ hasText: 'Turno Alteman' });
  await card.evaluate((source, target) => {
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
  }, await page.getByRole('button', { name: 'Carpeta Turnos, 0 notas' }).elementHandle());
  await expect(page.locator('.saved-note')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Carpeta Turnos, 1 notas' })).toBeVisible();
  await page.getByLabel('Mover “Resultados de sangre” a una carpeta').selectOption({ label: 'Turnos' });
  await expect(page.getByText('No hay notas sin carpeta.')).toBeVisible();
  await page.getByRole('button', { name: 'Carpeta Turnos, 2 notas' }).click();
  await expect(page.locator('.saved-note')).toHaveCount(2);
  await page.reload();
  await page.getByRole('button', { name: 'Carpeta Turnos, 2 notas' }).click();
  await page.getByRole('button', { name: 'Editar nombre' }).click();
  await expect(page.getByRole('heading', { name: '📁 Turnos médicos' })).toBeVisible();
  await page.getByRole('button', { name: 'Borrar carpeta' }).click();
  await expect(page.getByRole('button', { name: /^Carpeta / })).toHaveCount(0);
  await expect(page.locator('.saved-note')).toHaveCount(2);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001')!));
  expect(stored.noteFolders).toEqual([]);
  expect(stored.notes.every((note: { savedFolder?: string }) => note.savedFolder === undefined)).toBe(true);
});

test('abre carpetas de guardadas con doble clic y las reordena arrastrándolas', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await page.evaluate(() => {
    const at = '2026-01-01T00:00:00.000Z';
    localStorage.setItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001', JSON.stringify({ version: 1, notes: [
      { id: 'a', text: 'Turno dentista', color: '#bcdcf6', status: 'todo', history: [{ status: 'todo', at }], archivedAt: at, savedFolder: 'b' },
      { id: 'n', text: 'Nota suelta', color: '#ffe783', status: 'todo', history: [{ status: 'todo', at }], archivedAt: at },
    ], folders: [], expenses: [], noteFolders: [{ id: 'a', name: 'Recetas' }, { id: 'b', name: 'Turnos' }, { id: 'c', name: 'Estudios' }] }));
  });
  await page.reload();
  await page.getByRole('link', { name: 'Notas guardadas', exact: false }).click();
  const names = page.locator('.saved-folder strong');
  await expect(names).toHaveText(['Sin carpeta', 'Recetas', 'Turnos', 'Estudios']);
  await page.getByRole('button', { name: 'Carpeta Turnos, 1 notas' }).dblclick();
  await expect(page.getByRole('heading', { name: '📁 Turnos' })).toBeVisible();
  await expect(page.locator('.saved-note')).toHaveText([/Turno dentista/]);
  const drag = async (from: string, to: string, side: 'left' | 'right') => {
    const source = page.getByRole('button', { name: new RegExp(`^Carpeta ${from},`) });
    const target = page.getByRole('button', { name: new RegExp(`^Carpeta ${to},`) });
    const box = (await target.boundingBox())!;
    await source.evaluate((element, args) => {
      const transfer = new DataTransfer();
      const targetElement = document.querySelector(`[aria-label^="Carpeta ${args.to},"]`)!;
      element.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      targetElement.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: args.x, clientY: args.y }));
      targetElement.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: args.x, clientY: args.y }));
      element.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
    }, { to, x: side === 'left' ? box.x + 4 : box.x + box.width - 4, y: box.y + box.height / 2 });
  };
  await drag('Estudios', 'Recetas', 'left');
  await expect(names).toHaveText(['Sin carpeta', 'Estudios', 'Recetas', 'Turnos']);
  await drag('Estudios', 'Turnos', 'right');
  await expect(names).toHaveText(['Sin carpeta', 'Recetas', 'Turnos', 'Estudios']);
  await page.getByRole('button', { name: 'Mover carpeta a la izquierda' }).click();
  await expect(names).toHaveText(['Sin carpeta', 'Turnos', 'Recetas', 'Estudios']);
  await expect(page.locator('.saved-note')).toHaveText([/Turno dentista/]);
  await page.reload();
  await expect(names).toHaveText(['Sin carpeta', 'Turnos', 'Recetas', 'Estudios']);
  await page.getByRole('button', { name: 'Sin carpeta, 1 notas' }).dblclick();
  await expect(page.locator('.saved-note')).toHaveText([/Nota suelta/]);
});

test('ordena las tarjetas de guardadas arrastrándolas', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await page.evaluate(() => {
    const note = (id: string, text: string, at: string) => ({ id, text, color: '#bcdcf6', status: 'todo', history: [{ status: 'todo', at }], archivedAt: at });
    localStorage.setItem('escritorio-personal-v1:00000000-0000-4000-8000-000000000001', JSON.stringify({ version: 1, notes: [
      note('a', 'Alfa', '2026-01-03T00:00:00.000Z'), note('b', 'Beta', '2026-01-02T00:00:00.000Z'), note('c', 'Gamma', '2026-01-01T00:00:00.000Z'),
    ], folders: [], expenses: [], noteFolders: [{ id: 'f', name: 'Turnos' }] }));
  });
  await page.reload();
  await page.getByRole('link', { name: 'Notas guardadas', exact: false }).click();
  const texts = page.locator('.saved-note .note-text');
  await expect(texts).toHaveText(['Alfa', 'Beta', 'Gamma']);
  const drop = async (from: string, to: string, side: 'left' | 'right') => {
    const box = (await page.locator('.saved-note').filter({ hasText: to }).boundingBox())!;
    await page.locator('.saved-note').filter({ hasText: from }).evaluate((source, args) => {
      const transfer = new DataTransfer();
      const target = [...document.querySelectorAll('.saved-note')].find(element => element.querySelector('.note-text')!.textContent === args.to)!;
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: args.x, clientY: args.y }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: args.x, clientY: args.y }));
      source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
    }, { to, x: side === 'left' ? box.x + 4 : box.x + box.width - 4, y: box.y + box.height / 2 });
  };
  await drop('Gamma', 'Alfa', 'left');
  await expect(texts).toHaveText(['Gamma', 'Alfa', 'Beta']);
  await drop('Gamma', 'Beta', 'right');
  await expect(texts).toHaveText(['Alfa', 'Beta', 'Gamma']);
  await page.getByRole('button', { name: 'Mover “Beta” antes' }).click();
  await expect(texts).toHaveText(['Beta', 'Alfa', 'Gamma']);
  await expect(page.getByRole('button', { name: 'Mover “Beta” antes' })).toBeDisabled();
  await page.reload();
  await expect(texts).toHaveText(['Beta', 'Alfa', 'Gamma']);
  await page.getByLabel('Mover “Alfa” a una carpeta').selectOption({ label: 'Turnos' });
  await expect(texts).toHaveText(['Beta', 'Gamma']);
  await page.getByRole('button', { name: 'Carpeta Turnos, 1 notas' }).click();
  await expect(texts).toHaveText(['Alfa']);
});

test('los accesos graffiti de Mi diario llevan al escritorio y a gastos', async ({ page }) => {
  await page.goto('/escritorio-personal/');
  await page.getByRole('link', { name: 'Mi diario', exact: true }).click();
  const desk = page.getByRole('link', { name: 'Ir a Mi Escritorio' });
  const expenses = page.getByRole('link', { name: 'Ir a Gastos' });
  await expect(desk).toHaveCSS('color', 'rgb(46, 240, 127)');
  await expect(expenses).toHaveCSS('color', 'rgb(181, 108, 255)');
  await desk.click();
  await expect(page.getByRole('heading', { name: 'Notas del escritorio' })).toBeVisible();
  await page.getByRole('link', { name: 'Mi diario', exact: true }).click();
  await page.getByRole('link', { name: 'Ir a Gastos' }).click();
  await expect(page.getByRole('heading', { name: 'Mis gastos' })).toBeVisible();
});
