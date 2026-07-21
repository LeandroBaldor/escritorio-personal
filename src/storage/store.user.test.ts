import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY } from './model';
import { loadForUser, markMigrationDecided, migrationDecided, saveForUser } from './store';

describe('caché por usuario', () => {
  beforeEach(() => localStorage.clear());
  it('aísla los documentos de cuentas distintas', () => {
    saveForUser('cuenta-a', EMPTY);
    expect(loadForUser('cuenta-a')).toMatchObject({ data: EMPTY, exists: true });
    expect(loadForUser('cuenta-b').exists).toBe(false);
  });
  it('rechaza una caché inválida sin contaminar otra cuenta', () => {
    localStorage.setItem('escritorio-personal-v1:cuenta-a', '{}');
    expect(loadForUser('cuenta-a')).toMatchObject({ data: EMPTY, exists: false });
    expect(loadForUser('cuenta-a').warning).toBeTruthy();
  });
  it('registra globalmente que los datos heredados ya fueron decididos', () => {
    expect(migrationDecided()).toBe(false);
    markMigrationDecided();
    expect(migrationDecided()).toBe(true);
  });
});
