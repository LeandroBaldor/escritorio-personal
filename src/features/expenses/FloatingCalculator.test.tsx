import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FloatingCalculator } from './FloatingCalculator';

const press = (...labels: string[]) => labels.forEach(label => fireEvent.click(screen.getByRole('button', { name: label })));
const result = () => screen.getByRole('dialog', { name: 'Calculadora' }).querySelector('output')!.textContent;

describe('FloatingCalculator', () => {
  afterEach(cleanup);

  it('abre la calculadora y hace cuentas encadenadas con coma decimal', () => {
    render(<FloatingCalculator />);
    press('Calculadora', '1', '2', 'Sumar', '3', 'Multiplicar');
    expect(result()).toBe('15');
    press('2', 'Igual');
    expect(result()).toBe('30');
    press('Borrar todo', '0', 'Coma decimal', '1', 'Sumar', '0', 'Coma decimal', '2', 'Igual');
    expect(result()).toBe('0,3');
    press('Dividir', '0', 'Igual');
    expect(result()).toBe('Error');
  });

  it('se usa con el teclado y se cierra con Escape', () => {
    render(<FloatingCalculator />);
    press('Calculadora');
    const dialog = screen.getByRole('dialog', { name: 'Calculadora' });
    for (const key of ['9', '-', '4', 'Enter']) fireEvent.keyDown(dialog, { key });
    expect(result()).toBe('5');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
