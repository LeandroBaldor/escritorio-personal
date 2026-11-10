import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Vampyium2Decision } from './Vampyium2Decision';

describe('carteles de Vampyium 2', () => {
  it('la derrota ofrece reintentar y debajo volver al menú', () => {
    const retry = vi.fn(), menu = vi.fn(), resume = vi.fn();
    render(<Vampyium2Decision defeated onRetry={retry} onMenu={menu} onContinue={resume} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map(b => b.textContent)).toEqual(['Volver a intentar', 'Volver al Menú']);
    fireEvent.click(buttons[0]); fireEvent.click(buttons[1]);
    expect(retry).toHaveBeenCalledOnce(); expect(menu).toHaveBeenCalledOnce(); expect(resume).not.toHaveBeenCalled();
  });
  it('la pausa conserva Seguir y regresa al menú', () => {
    const resume = vi.fn();
    render(<Vampyium2Decision defeated={false} onRetry={vi.fn()} onMenu={vi.fn()} onContinue={resume} />);
    expect(screen.getByRole('heading', { name: 'Pausa' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir' })); expect(resume).toHaveBeenCalledOnce();
  });
});
