import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthScreen } from './AuthScreen';
const signIn = vi.fn(); const signUp = vi.fn();
vi.mock('./AuthContext', () => ({ useAuth: () => ({ signIn, signUp, error: undefined, notice: undefined }) }));
describe('AuthScreen', () => {
  afterEach(cleanup);
  beforeEach(() => { signIn.mockReset(); signUp.mockReset(); });
  it('envía credenciales al login y permite cambiar a registro', async () => {
    render(<AuthScreen />); fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'persona@example.com' } }); fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreto1' } }); fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(signIn).toHaveBeenCalledWith('persona@example.com', 'secreto1');
    fireEvent.click(screen.getByRole('button', { name: 'Crear una cuenta' })); await waitFor(() => expect(screen.getByRole('button', { name: 'Registrarme' })).toBeVisible());
  });
});
