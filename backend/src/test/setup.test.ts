// A2-E1-05: las pruebas de dominio/ (funciones puras) no vacían la BD antes de cada prueba
import { describe, expect, it } from 'vitest';
import { usaBd } from './setup';

describe('usaBd', () => {
  it('las pruebas de dominio/ no usan la BD, con / o con \\ (Windows)', () => {
    expect(usaBd('/repo/backend/src/modules/espacios/dominio/vigencia.test.ts')).toBe(false);
    expect(usaBd(String.raw`C:\repo\backend\src\lib\dominio\periodo.test.ts`)).toBe(false);
  });

  it('el resto sí la usa (y una ruta desconocida también, por seguridad)', () => {
    expect(usaBd('/repo/backend/src/modules/diezmo/diezmo.test.ts')).toBe(true);
    expect(usaBd('/repo/backend/src/modules/dominios-raros/x.test.ts')).toBe(true);
    expect(usaBd(undefined)).toBe(true);
  });
});
