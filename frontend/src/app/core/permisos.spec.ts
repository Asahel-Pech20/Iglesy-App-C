import { describe, expect, it } from 'vitest';
import { PERMISOS_POR_ROL, tienePermiso } from './permisos';

// Matriz de specs.md §3 (copia exacta de backend/src/config/permisos.ts)
describe('core/permisos', () => {
  it('solo ADMIN_IGLESIA gestiona usuarios', () => {
    expect(tienePermiso('ADMIN_IGLESIA', 'usuarios:crear')).toBe(true);
    for (const rol of ['PASTOR', 'SECRETARIO', 'TESORERO', 'COORDINADOR'] as const) {
      expect(tienePermiso(rol, 'usuarios:leer')).toBe(false);
    }
  });

  it('los datos financieros solo para ADMIN_IGLESIA, PASTOR y TESORERO', () => {
    expect(tienePermiso('PASTOR', 'donaciones:leer')).toBe(true);
    expect(tienePermiso('SECRETARIO', 'donaciones:leer')).toBe(false);
    expect(tienePermiso('COORDINADOR', 'donaciones:leer')).toBe(false);
  });

  it('el COORDINADOR usa las variantes -propio', () => {
    expect(PERMISOS_POR_ROL.COORDINADOR).toContain('ministerios:editar-propio');
    expect(tienePermiso('COORDINADOR', 'ministerios:editar')).toBe(false);
  });
});
